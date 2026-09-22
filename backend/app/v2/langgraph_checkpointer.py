"""Synchronous LangGraph saver bound to one authorized analysis run.

This is storage infrastructure only; no analysis stages are enabled here.
"""

import base64
from collections.abc import Iterator, Sequence
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.v2.checkpoints import get_checkpoint, put_checkpoint, require_run_access
from app.v2.workspaces import WorkspaceAccess


class ScopedLangGraphSaver(BaseCheckpointSaver[int]):
    def __init__(self, session: Session, workspace: WorkspaceAccess, run_id: UUID) -> None:
        super().__init__()
        self.session = session
        self.workspace = workspace
        self.run_id = run_id

    def _parts(self, config: RunnableConfig) -> tuple[str, UUID | None]:
        configurable = config.get("configurable") or {}
        if str(configurable.get("thread_id")) != str(self.run_id):
            raise HTTPException(status_code=403, detail="Checkpoint thread access denied.")
        namespace = str(configurable.get("checkpoint_ns", ""))
        checkpoint_id = configurable.get("checkpoint_id")
        try:
            return namespace, UUID(str(checkpoint_id)) if checkpoint_id else None
        except ValueError as error:
            raise HTTPException(status_code=403, detail="Checkpoint access denied.") from error

    def _dump(self, value: Any) -> dict[str, str]:
        kind, data = self.serde.dumps_typed(value)
        return {"type": kind, "data": base64.b64encode(data).decode("ascii")}

    def _load(self, value: dict[str, str]) -> Any:
        return self.serde.loads_typed((value["type"], base64.b64decode(value["data"])))

    def _tuple(self, checkpoint_id: UUID, namespace: str) -> CheckpointTuple | None:
        stored = get_checkpoint(self.session, self.workspace, self.run_id, checkpoint_id)
        if stored is None or stored.state.get("namespace") != namespace:
            return None
        state = stored.state
        checkpoint: Checkpoint = self._load(state["checkpoint"])
        checkpoint["id"] = str(stored.id)
        metadata: CheckpointMetadata = self._load(state["metadata"])
        configurable = {"thread_id": str(self.run_id), "checkpoint_ns": namespace, "checkpoint_id": str(stored.id)}
        parent = stored.parent_checkpoint_key
        return CheckpointTuple(
            config={"configurable": configurable},
            checkpoint=checkpoint,
            metadata=metadata,
            parent_config={"configurable": {**configurable, "checkpoint_id": parent}} if parent else None,
            pending_writes=[(item["task_id"], item["channel"], self._load(item["value"]))
                            for item in state.get("writes", [])],
        )

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        namespace, checkpoint_id = self._parts(config)
        require_run_access(self.session, self.workspace, self.run_id)
        if checkpoint_id is None:
            row = self.session.execute(text("""
                select c.id from public.graph_checkpoints c
                join public.analysis_runs r on r.id = c.analysis_run_id
                where c.analysis_run_id = :run_id and r.workspace_id = :workspace_id
                  and c.state ->> 'namespace' = :namespace
                order by c.created_at desc, c.id desc limit 1
            """), {"run_id": self.run_id, "workspace_id": self.workspace.id,
                   "namespace": namespace}).scalar_one_or_none()
            if row is None:
                return None
            checkpoint_id = row
        return self._tuple(checkpoint_id, namespace)

    def put(
        self, config: RunnableConfig, checkpoint: Checkpoint,
        metadata: CheckpointMetadata, new_versions: ChannelVersions,
    ) -> RunnableConfig:
        namespace, parent_id = self._parts(config)
        del new_versions  # A complete serialized snapshot is saved for every checkpoint.
        if parent_id is not None and self._tuple(parent_id, namespace) is None:
            raise HTTPException(status_code=403, detail="Parent checkpoint access denied.")
        stored = put_checkpoint(
            self.session, self.workspace, self.run_id,
            {"namespace": namespace, "checkpoint": self._dump(checkpoint),
             "metadata": self._dump(metadata), "writes": []},
            parent_checkpoint_id=parent_id,
        )
        return {"configurable": {"thread_id": str(self.run_id), "checkpoint_ns": namespace,
                                 "checkpoint_id": str(stored.id)}}

    def put_writes(
        self, config: RunnableConfig, writes: Sequence[tuple[str, Any]],
        task_id: str, task_path: str = "",
    ) -> None:
        namespace, checkpoint_id = self._parts(config)
        if checkpoint_id is None or self._tuple(checkpoint_id, namespace) is None:
            raise HTTPException(status_code=403, detail="Checkpoint access denied.")
        encoded = [{"task_id": task_id, "task_path": task_path, "channel": channel,
                    "value": self._dump(value)} for channel, value in writes]
        updated = self.session.execute(text("""
            update public.graph_checkpoints c
            set state = jsonb_set(c.state, '{writes}', coalesce(c.state -> 'writes', '[]'::jsonb) || :writes, true)
            where c.id = :checkpoint_id and c.analysis_run_id = :run_id
              and exists (select 1 from public.analysis_runs r
                          where r.id = c.analysis_run_id and r.workspace_id = :workspace_id)
            returning c.id
        """).bindparams(bindparam("writes", type_=JSONB)),
            {"checkpoint_id": checkpoint_id, "run_id": self.run_id,
             "workspace_id": self.workspace.id, "writes": encoded})
        if updated.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Checkpoint access denied.")

    def list(
        self, config: RunnableConfig | None, *, filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None, limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        if config is None:
            raise HTTPException(status_code=403, detail="Checkpoint thread access denied.")
        if limit is not None and limit <= 0:
            return
        namespace, selected_id = self._parts(config)
        require_run_access(self.session, self.workspace, self.run_id)
        before_id = self._parts(before)[1] if before else None
        rows = self.session.execute(text("""
            select c.id from public.graph_checkpoints c
            join public.analysis_runs r on r.id = c.analysis_run_id
            where c.analysis_run_id = :run_id and r.workspace_id = :workspace_id
              and c.state ->> 'namespace' = :namespace
            order by c.created_at desc, c.id desc
        """), {"run_id": self.run_id, "workspace_id": self.workspace.id,
               "namespace": namespace}).scalars()
        yielded = 0
        seen_before = before_id is None
        for checkpoint_id in rows:
            if not seen_before:
                if checkpoint_id == before_id:
                    seen_before = True
                continue
            if selected_id and checkpoint_id != selected_id:
                continue
            item = self._tuple(checkpoint_id, namespace)
            if item is None or (filter and any(item.metadata.get(k) != v for k, v in filter.items())):
                continue
            yield item
            yielded += 1
            if limit is not None and yielded >= limit:
                return
