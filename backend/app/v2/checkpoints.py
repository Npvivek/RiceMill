"""Workspace-scoped checkpoint storage for future LangGraph run persistence.

No graph stages are activated here. This store is the only approved path to the
existing graph_checkpoints table when those stages are introduced.
"""

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from app.v2.workspaces import WorkspaceAccess


@dataclass(frozen=True)
class StoredCheckpoint:
    id: UUID
    analysis_run_id: UUID
    parent_checkpoint_key: str | None
    state: dict[str, Any]


def require_run_access(session: Session, workspace: WorkspaceAccess, run_id: UUID) -> None:
    found = session.execute(
        text("select 1 from public.analysis_runs where id = :run_id and workspace_id = :workspace_id"),
        {"run_id": run_id, "workspace_id": workspace.id},
    ).scalar_one_or_none()
    if found is None:
        raise HTTPException(status_code=403, detail="Analysis run access denied.")


def get_checkpoint(
    session: Session, workspace: WorkspaceAccess, run_id: UUID, checkpoint_id: UUID
) -> StoredCheckpoint | None:
    require_run_access(session, workspace, run_id)
    row = session.execute(
        text("""
            select c.id, c.analysis_run_id, c.parent_checkpoint_key, c.state
            from public.graph_checkpoints c
            join public.analysis_runs r on r.id = c.analysis_run_id
            where c.id = :checkpoint_id and c.analysis_run_id = :run_id and r.workspace_id = :workspace_id
        """),
        {"checkpoint_id": checkpoint_id, "run_id": run_id, "workspace_id": workspace.id},
    ).mappings().first()
    if row is None:
        return None
    return StoredCheckpoint(
        id=row["id"], analysis_run_id=row["analysis_run_id"],
        parent_checkpoint_key=row["parent_checkpoint_key"], state=row["state"],
    )


def put_checkpoint(
    session: Session,
    workspace: WorkspaceAccess,
    run_id: UUID,
    state: dict[str, Any],
    parent_checkpoint_id: UUID | None = None,
) -> StoredCheckpoint:
    require_run_access(session, workspace, run_id)
    if parent_checkpoint_id is not None and get_checkpoint(session, workspace, run_id, parent_checkpoint_id) is None:
        raise HTTPException(status_code=403, detail="Parent checkpoint access denied.")
    checkpoint_id = uuid4()
    # The key is created here, never accepted from client input. Keep it stable
    # for the future LangGraph adapter's parent references.
    checkpoint_key = str(checkpoint_id)
    session.execute(
        text("""
            insert into public.graph_checkpoints
                (id, analysis_run_id, checkpoint_key, parent_checkpoint_key, state)
            values (:id, :run_id, :key, :parent_key, :state)
        """).bindparams(bindparam("state", type_=JSONB)),
        {"id": checkpoint_id, "run_id": run_id, "key": checkpoint_key,
         "parent_key": str(parent_checkpoint_id) if parent_checkpoint_id else None,
         "state": state},
    )
    return StoredCheckpoint(
        id=checkpoint_id, analysis_run_id=run_id,
        parent_checkpoint_key=str(parent_checkpoint_id) if parent_checkpoint_id else None,
        state=state,
    )
