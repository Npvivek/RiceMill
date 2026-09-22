from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.v2.auth import AuthenticatedUser, get_current_user
from app.v2.db import get_scoped_session
from app.v2.workspaces import WorkspaceAccess, list_memberships, require_workspace

router = APIRouter()


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    role: str


@router.get("/workspaces", response_model=list[WorkspaceResponse])
def workspaces(
    session: Session = Depends(get_scoped_session), user: AuthenticatedUser = Depends(get_current_user)
) -> list[WorkspaceResponse]:
    return [WorkspaceResponse(id=item.id, name=item.name, role=item.role) for item in list_memberships(session, user)]


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
def workspace(access: WorkspaceAccess = Depends(require_workspace)) -> WorkspaceResponse:
    return WorkspaceResponse(id=access.id, name=access.name, role=access.role)
