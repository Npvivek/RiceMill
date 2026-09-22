"""Membership-derived workspace access. A URL workspace UUID only selects a target."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.db import get_scoped_session


@dataclass(frozen=True)
class WorkspaceAccess:
    id: UUID
    name: str
    role: str


def list_memberships(session: Session, user: AuthenticatedUser) -> list[WorkspaceAccess]:
    rows = session.execute(
        text("""
            select w.id, w.name, m.role
            from public.workspace_members m
            join public.workspaces w on w.id = m.workspace_id
            where m.user_id = :user_id
            order by w.created_at, w.id
        """),
        {"user_id": user.id},
    ).mappings()
    return [WorkspaceAccess(id=row["id"], name=row["name"], role=row["role"]) for row in rows]


def require_workspace(
    workspace_id: UUID,
    session: Session = Depends(get_scoped_session),
    user: AuthenticatedUser = Depends(get_current_user),
) -> WorkspaceAccess:
    row = session.execute(
        text("""
            select w.id, w.name, m.role
            from public.workspace_members m
            join public.workspaces w on w.id = m.workspace_id
            where m.user_id = :user_id and m.workspace_id = :workspace_id
        """),
        {"user_id": user.id, "workspace_id": workspace_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=403, detail="Workspace access denied.")
    return WorkspaceAccess(id=row["id"], name=row["name"], role=row["role"])
