from fastapi import APIRouter

from app.v2.api.routes import analysis, conversations, health, imports, users, workspaces

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(users.router, prefix="/v2", tags=["identity"])
api_router.include_router(workspaces.router, prefix="/v2", tags=["workspaces"])
api_router.include_router(imports.router, prefix="/v2", tags=["imports"])
api_router.include_router(analysis.router, prefix="/v2", tags=["analysis"])
api_router.include_router(conversations.router, prefix="/v2", tags=["conversations"])
