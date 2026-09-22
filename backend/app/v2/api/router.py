from fastapi import APIRouter

from app.v2.api.routes import health, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(users.router, prefix="/v2", tags=["identity"])
