"""Owner-scoped conversation storage and isolated, restricted chat checkpoints."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict
import json
from typing import Any, Iterator, Literal
from uuid import UUID, uuid4

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg.rows import dict_row
from sqlalchemy import text
from sqlalchemy.engine import Engine, make_url

from app.v2.ai.chat_graph import ToolDispatcher, run_turn
from app.v2.ai.openrouter import OpenRouterClient, ProviderRejected
from app.v2.ai.service import AnalysisFailure, PostgresAnalysisRepository
from app.v2.ai.tools import AnalysisTools

ANOMALY_PROMPT = (
    "Inspect exact raw descriptions in the recent transaction sample. Report only evidence-backed "
    "observations that a person could review, with exact citations. Say when the sample is too small "
    "or has no defensible anomaly. Do not claim a candidate is an error or calculate totals."
)


class ConversationFailure(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        self.code, self.message, self.status_code = code, message, status_code
        super().__init__(message)


@contextmanager
def scoped_chat_checkpointer(url: str, subject: UUID) -> Iterator[PostgresSaver]:
    """A dedicated session-pooler connection is closed after each request; RLS still applies."""
    parsed = make_url(url)
    if parsed.drivername != "postgresql+psycopg" or not parsed.username or parsed.username.split(".")[0] != "mill_runtime":
        raise ValueError("Chat checkpoints require the restricted runtime role.")
    with psycopg.connect(
        dbname=parsed.database, user=parsed.username, password=parsed.password,
        host=parsed.host, port=parsed.port, sslmode="require", connect_timeout=5,
        autocommit=True, row_factory=dict_row,
    ) as connection:
        connection.execute("set search_path to chat_graph, public")
        connection.execute("select set_config('request.jwt.claim.sub', %s, false)", (str(subject),))
        connection.execute("set statement_timeout to '30000'")
        yield PostgresSaver(connection, serde=JsonPlusSerializer(allowed_msgpack_modules=[]))


class ConversationService:
    def __init__(self, engine: Engine, runtime_url: str, api_key: str) -> None:
        self.repository = PostgresAnalysisRepository(engine)
        self.runtime_url = runtime_url
        self.api_key = api_key

    def _thread(self, user_id: UUID, thread_id: UUID) -> dict[str, Any]:
        with self.repository._session(user_id) as session:
            workspace = self.repository._workspace(session, user_id)
            row = session.execute(text("""
                select id, dataset_version_id, mode, created_at from public.conversations
                where id = :thread and workspace_id = :workspace and created_by = :user
            """), {"thread": thread_id, "workspace": workspace.id, "user": user_id}).mappings().first()
            if row is None:
                raise ConversationFailure("thread_not_found", "Conversation not found.", 404)
            return dict(row)

    def get(self, user_id: UUID, thread_id: UUID) -> dict[str, Any]:
        thread = self._thread(user_id, thread_id)
        with self.repository._session(user_id) as session:
            rows = session.execute(text("""
                select id, author_type, content, segments, response_kind, created_at
                from public.conversation_messages where conversation_id = :thread
                order by created_at desc,
                  case when author_type = 'assistant' then 1 else 0 end desc, id desc limit 100
            """), {"thread": thread_id}).mappings()
            thread["messages"] = list(reversed([dict(row) for row in rows]))
        return thread

    def create(self, user_id: UUID, version_id: UUID,
               mode: Literal["chat", "anomalies"]) -> dict[str, Any]:
        if not self.api_key:
            raise ConversationFailure("ai_not_configured", "AI provider is not configured.", 503)
        with self.repository._session(user_id) as session:
            workspace = self.repository._workspace(session, user_id)
            self.repository._version(session, workspace.id, version_id)
            thread_id = uuid4()
            session.execute(text("""
                insert into public.conversations (id, workspace_id, dataset_version_id, created_by, mode)
                values (:thread, :workspace, :version, :user, :mode)
            """), {"thread": thread_id, "workspace": workspace.id, "version": version_id,
                   "user": user_id, "mode": mode})
        if mode == "anomalies":
            self._answer(user_id, thread_id, version_id, ANOMALY_PROMPT, mode)
        return self.get(user_id, thread_id)

    def post(self, user_id: UUID, thread_id: UUID, content: str) -> dict[str, Any]:
        thread = self._thread(user_id, thread_id)
        if thread["mode"] != "chat":
            raise ConversationFailure("read_only_thread", "Anomaly observations cannot be continued.", 409)
        self._answer(user_id, thread_id, thread["dataset_version_id"], content, "chat")
        return self.get(user_id, thread_id)

    def _answer(self, user_id: UUID, thread_id: UUID, version_id: UUID, content: str,
                mode: Literal["chat", "anomalies"]) -> None:
        tools = AnalysisTools(self.repository, user_id)
        dispatcher = ToolDispatcher(tools, version_id)
        if mode == "chat":
            previous = self.get(user_id, thread_id)["messages"]
            history = [{"role": row["author_type"], "content": row["content"]}
                       for row in previous[-10:]] + [{"role": "user", "content": content}]
        else:
            history = [{"role": "user", "content": content}]
        if not self.api_key:
            raise ConversationFailure("ai_not_configured", "AI provider is not configured.", 503)
        try:
            with OpenRouterClient(self.api_key) as model:
                if mode == "chat":
                    with scoped_chat_checkpointer(self.runtime_url, user_id) as saver:
                        answer = run_turn(mode=mode, history=history, dispatcher=dispatcher,
                                          model=model, checkpointer=saver, thread_id=thread_id)
                else:
                    answer = run_turn(mode=mode, history=history, dispatcher=dispatcher, model=model)
        except ProviderRejected as error:
            raise ConversationFailure("ai_rejected", "AI response was unavailable. Retry later.", 503) from error
        with self.repository._session(user_id) as session:
            workspace = self.repository._workspace(session, user_id)
            owned = session.execute(text("""
                select 1 from public.conversations where id = :thread and workspace_id = :workspace
                  and created_by = :user and dataset_version_id = :version
            """), {"thread": thread_id, "workspace": workspace.id, "user": user_id,
                   "version": version_id}).scalar_one_or_none()
            if owned is None:
                raise ConversationFailure("thread_not_found", "Conversation not found.", 404)
            session.execute(text("""
                insert into public.conversation_messages (conversation_id, author_type, content)
                values (:thread, 'user', :content)
            """), {"thread": thread_id, "content": content})
            session.execute(text("""
                insert into public.conversation_messages
                  (conversation_id, author_type, content, segments, response_kind)
                values (:thread, 'assistant', :content, cast(:segments as jsonb), :kind)
            """), {"thread": thread_id, "content": answer.content,
                   "segments": json.dumps([asdict(item) for item in answer.segments]),
                   "kind": answer.kind})

    def static_findings(self, user_id: UUID, version_id: UUID) -> list[dict[str, str]]:
        try:
            page = self.repository.list(user_id, version_id, 1, 1)
        except AnalysisFailure:
            return []
        if not page["items"]:
            return []
        return [{"title": finding["title"], "explanation": finding["explanation"]}
                for finding in page["items"][0]["findings"]]
