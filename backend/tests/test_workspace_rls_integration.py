"""Opt-in live Postgres policy test. Uses only synthetic rows and cleans them up.

Set TEST_MIGRATION_DATABASE_URL, TEST_RUNTIME_DATABASE_URL, and TEST_USER_A to
one existing auth.users ID. Run separately from ordinary pytest. The test
creates two synthetic workspaces and removes the user's membership from B.
"""

import os
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.v2.checkpoints import get_checkpoint, put_checkpoint
from app.v2.db import runtime_engine
from app.v2.langgraph_checkpointer import ScopedLangGraphSaver
from app.v2.workspaces import WorkspaceAccess

REQUIRED = ("TEST_MIGRATION_DATABASE_URL", "TEST_RUNTIME_DATABASE_URL", "TEST_USER_A")


@pytest.mark.skipif(not all(os.getenv(key) for key in REQUIRED), reason="Live Postgres test credentials not configured")
def test_restricted_role_rls_isolates_workspaces_and_checkpoints() -> None:
    user_a = UUID(os.environ["TEST_USER_A"])
    admin = create_engine(os.environ["TEST_MIGRATION_DATABASE_URL"])
    runtime = runtime_engine(os.environ["TEST_RUNTIME_DATABASE_URL"], "production")
    spaces = (uuid4(), uuid4())
    imports = (uuid4(), uuid4())
    versions = (uuid4(), uuid4())
    runs = (uuid4(), uuid4())
    seed = uuid4()

    try:
        with admin.begin() as connection:
            for index in range(2):
                connection.execute(text("insert into public.workspaces (id, name, created_by) values (:id, :name, :user)"),
                                   {"id": spaces[index], "name": f"RLS test {seed}", "user": user_a})
                if index == 1:
                    connection.execute(text("delete from public.workspace_members where workspace_id = :space and user_id = :user"),
                                       {"space": spaces[index], "user": user_a})
                connection.execute(text("""
                    insert into public.imports (id, workspace_id, uploaded_by, file_name, file_hash,
                        file_size, storage_path, parser_version, status)
                    values (:id, :workspace, :user, 'synthetic.xlsx', :hash, 1, :path, 'test', 'staged')
                """), {"id": imports[index], "workspace": spaces[index], "user": user_a,
                        "hash": uuid4().hex + uuid4().hex, "path": f"{spaces[index]}/rls-test/{seed}"})
                connection.execute(text("""
                    insert into public.dataset_versions (id, workspace_id, import_id, version_number, status, created_by)
                    values (:id, :workspace, :import_id, 1, 'committed', :user)
                """), {"id": versions[index], "workspace": spaces[index], "import_id": imports[index], "user": user_a})
                connection.execute(text("""
                    insert into public.analysis_runs (id, workspace_id, dataset_version_id, requested_by,
                        graph_version, prompt_version, model_id, status)
                    values (:id, :workspace, :version, :user, 'rls-test', 'rls-test', 'deterministic', 'queued')
                """), {"id": runs[index], "workspace": spaces[index], "version": versions[index], "user": user_a})
            foreign_checkpoint_id = uuid4()
            connection.execute(text("""
                insert into public.graph_checkpoints (id, analysis_run_id, checkpoint_key, state)
                values (:id, :run_id, :key, '{"stage":"foreign"}'::jsonb)
            """), {"id": foreign_checkpoint_id, "run_id": runs[1], "key": str(foreign_checkpoint_id)})
            for run_id in runs:
                connection.execute(text("""
                    insert into public.tool_results (analysis_run_id, tool_name, input, result)
                    values (:run_id, 'get_data_quality', '{}'::jsonb, '{}'::jsonb)
                """), {"run_id": run_id})
                connection.execute(text("""
                    insert into public.findings (analysis_run_id, finding_type, severity, title,
                        explanation, metric_refs, source_refs, limitations)
                    values (:run_id, 'data_quality', 'info', 'synthetic', 'synthetic',
                        '[]'::jsonb, '[]'::jsonb, 'synthetic')
                """), {"run_id": run_id})

        with runtime.connect() as connection:
            assert connection.execute(text("select current_user")).scalar_one() == "mill_runtime"

        access = WorkspaceAccess(id=spaces[0], name="RLS test", role="owner")
        with Session(runtime) as session, session.begin():
            session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"), {"subject": str(user_a)})
            visible = session.execute(text("select id from public.workspaces where id in (:a, :b)"),
                                      {"a": spaces[0], "b": spaces[1]}).scalars().all()
            assert visible == [spaces[0]]
            assert session.execute(text("select id from public.analysis_runs where id = :id"),
                                   {"id": runs[1]}).scalar_one_or_none() is None
            assert session.execute(text("""
                update public.analysis_runs set status = 'cancelled' where id = :id returning id
            """), {"id": runs[1]}).scalar_one_or_none() is None
            assert session.execute(text("select count(*) from public.graph_checkpoints where analysis_run_id = :id"),
                                   {"id": runs[1]}).scalar_one() == 0
            for table in ("tool_results", "findings"):
                assert session.execute(text(f"select count(*) from public.{table} where analysis_run_id = :id"),
                                       {"id": runs[1]}).scalar_one() == 0
            own = put_checkpoint(session, access, runs[0], {"stage": "test"})
            assert get_checkpoint(session, access, runs[0], own.id) is not None
            with pytest.raises(HTTPException) as denied:
                put_checkpoint(session, access, runs[1], {"stage": "foreign"})
            assert denied.value.status_code == 403
            with pytest.raises(HTTPException) as denied_read:
                get_checkpoint(session, access, runs[1], foreign_checkpoint_id)
            assert denied_read.value.status_code == 403
            saver = ScopedLangGraphSaver(session, access, runs[0])
            config = {"configurable": {"thread_id": str(runs[0]), "checkpoint_ns": ""}}
            checkpoint = {"v": 1, "id": "internal", "ts": "now", "channel_values": {"count": 2},
                          "channel_versions": {}, "versions_seen": {}}
            saved = saver.put(config, checkpoint, {"source": "rls-test", "step": 1}, {})
            loaded = saver.get_tuple(saved)
            assert loaded is not None and loaded.checkpoint["channel_values"] == {"count": 2}
            with pytest.raises(HTTPException) as denied_thread:
                saver.get_tuple({"configurable": {"thread_id": str(runs[1]), "checkpoint_ns": ""}})
            assert denied_thread.value.status_code == 403
            updated = session.execute(text("update public.graph_checkpoints set state = '{}'::jsonb where analysis_run_id = :id"),
                                      {"id": runs[1]})
            assert updated.rowcount == 0
        # A raw SQL insert must also be blocked by RLS, independently of repository checks.
        with pytest.raises(SQLAlchemyError), Session(runtime) as session, session.begin():
            session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                            {"subject": str(user_a)})
            session.execute(text("""
                insert into public.graph_checkpoints (analysis_run_id, checkpoint_key, state)
                values (:run_id, :key, '{}'::jsonb)
            """), {"run_id": runs[1], "key": str(uuid4())})

        for table, columns, values in (
            ("tool_results", "tool_name, input, result", "'get_data_quality', '{}'::jsonb, '{}'::jsonb"),
            ("findings", "finding_type, severity, title, explanation, metric_refs, source_refs, limitations",
             "'data_quality', 'info', 'synthetic', 'synthetic', '[]'::jsonb, '[]'::jsonb, 'synthetic'"),
        ):
            with pytest.raises(SQLAlchemyError), Session(runtime) as session, session.begin():
                session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                                {"subject": str(user_a)})
                session.execute(text(f"insert into public.{table} (analysis_run_id, {columns}) "
                                     f"values (:run_id, {values})"), {"run_id": runs[1]})
        with pytest.raises(SQLAlchemyError), Session(runtime) as session, session.begin():
            session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                            {"subject": str(user_a)})
            session.execute(text("""
                insert into public.analysis_runs (workspace_id, dataset_version_id, requested_by,
                    graph_version, prompt_version, model_id, status)
                values (:workspace, :version, :user, 'rls-write', 'rls-write', 'deterministic', 'queued')
            """), {"workspace": spaces[1], "version": versions[1], "user": user_a})

        with Session(runtime) as session, session.begin():
            # A returned pooled connection has no previous request's claim.
            assert session.execute(text("select count(*) from public.workspaces where id in (:a, :b)"),
                                   {"a": spaces[0], "b": spaces[1]}).scalar_one() == 0
    finally:
        with admin.begin() as connection:
            for table, ids in (("graph_checkpoints", runs), ("analysis_runs", runs),
                               ("dataset_versions", versions), ("imports", imports), ("workspaces", spaces)):
                column = "analysis_run_id" if table == "graph_checkpoints" else "id"
                connection.execute(text(f"delete from public.{table} where {column} in (:a, :b)"),
                                   {"a": ids[0], "b": ids[1]})
        runtime.dispose()
        admin.dispose()
