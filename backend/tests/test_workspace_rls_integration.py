"""Opt-in live Postgres policy test. Uses only synthetic rows and cleans them up.

Set TEST_MIGRATION_DATABASE_URL, TEST_RUNTIME_DATABASE_URL, TEST_USER_A and
TEST_USER_B to two existing auth.users IDs. Run separately from ordinary pytest.
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
from app.v2.workspaces import WorkspaceAccess

REQUIRED = ("TEST_MIGRATION_DATABASE_URL", "TEST_RUNTIME_DATABASE_URL", "TEST_USER_A", "TEST_USER_B")


@pytest.mark.skipif(not all(os.getenv(key) for key in REQUIRED), reason="Live Postgres test credentials not configured")
def test_restricted_role_rls_isolates_workspaces_and_checkpoints() -> None:
    user_a = UUID(os.environ["TEST_USER_A"])
    user_b = UUID(os.environ["TEST_USER_B"])
    admin = create_engine(os.environ["TEST_MIGRATION_DATABASE_URL"])
    runtime = runtime_engine(os.environ["TEST_RUNTIME_DATABASE_URL"], "production")
    spaces = (uuid4(), uuid4())
    imports = (uuid4(), uuid4())
    versions = (uuid4(), uuid4())
    runs = (uuid4(), uuid4())
    seed = uuid4()

    try:
        with admin.begin() as connection:
            for index, user in enumerate((user_a, user_b)):
                connection.execute(text("insert into public.workspaces (id, name, created_by) values (:id, :name, :user)"),
                                   {"id": spaces[index], "name": f"RLS test {seed}", "user": user})
                connection.execute(text("""
                    insert into public.imports (id, workspace_id, uploaded_by, file_name, file_hash,
                        file_size, storage_path, parser_version, status)
                    values (:id, :workspace, :user, 'synthetic.xlsx', :hash, 1, :path, 'test', 'staged')
                """), {"id": imports[index], "workspace": spaces[index], "user": user,
                        "hash": uuid4().hex + uuid4().hex, "path": f"{spaces[index]}/rls-test/{seed}"})
                connection.execute(text("""
                    insert into public.dataset_versions (id, workspace_id, import_id, version_number, status, created_by)
                    values (:id, :workspace, :import_id, 1, 'committed', :user)
                """), {"id": versions[index], "workspace": spaces[index], "import_id": imports[index], "user": user})
                connection.execute(text("""
                    insert into public.analysis_runs (id, workspace_id, dataset_version_id, requested_by,
                        graph_version, prompt_version, model_id, status)
                    values (:id, :workspace, :version, :user, 'rls-test', 'rls-test', 'deterministic', 'queued')
                """), {"id": runs[index], "workspace": spaces[index], "version": versions[index], "user": user})

        with runtime.connect() as connection:
            assert connection.execute(text("select current_user")).scalar_one() == "mill_runtime"

        for index, user in enumerate((user_a, user_b)):
            other = 1 - index
            access = WorkspaceAccess(id=spaces[index], name="RLS test", role="owner")
            with Session(runtime) as session, session.begin():
                session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"), {"subject": str(user)})
                visible = session.execute(text("select id from public.workspaces where id in (:a, :b)"),
                                          {"a": spaces[0], "b": spaces[1]}).scalars().all()
                assert visible == [spaces[index]]
                assert session.execute(text("select id from public.analysis_runs where id = :id"),
                                       {"id": runs[other]}).scalar_one_or_none() is None
                own = put_checkpoint(session, access, runs[index], {"stage": "test"})
                assert get_checkpoint(session, access, runs[index], own.id) is not None
                with pytest.raises(HTTPException) as denied:
                    put_checkpoint(session, access, runs[other], {"stage": "foreign"})
                assert denied.value.status_code == 403
            # A raw SQL insert must also be blocked by RLS, independently of repository checks.
            with pytest.raises(SQLAlchemyError), Session(runtime) as session, session.begin():
                session.execute(text("select set_config('request.jwt.claim.sub', :subject, true)"),
                                {"subject": str(user)})
                session.execute(text("""
                    insert into public.graph_checkpoints (analysis_run_id, checkpoint_key, state)
                    values (:run_id, :key, '{}'::jsonb)
                """), {"run_id": runs[other], "key": str(uuid4())})

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
