from fastapi import APIRouter

from app.v2.api.routes import health, users, workspaces

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(users.router, prefix="/v2", tags=["identity"])
api_router.include_router(workspaces.router, prefix="/v2", tags=["workspaces"])
