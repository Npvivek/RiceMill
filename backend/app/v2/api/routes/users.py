from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.v2.auth import AuthenticatedUser, get_current_user

router = APIRouter()


class CurrentUserResponse(BaseModel):
    id: str
    email: str | None


@router.get("/me", response_model=CurrentUserResponse)
def current_user(user: AuthenticatedUser = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(id=user.id, email=user.email)
