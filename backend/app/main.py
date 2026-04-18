from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import Base, engine
from . import models  # ensures all models are registered
from .routers import auth, inventory, parties, labor, reports, public, orders

# Create tables (dev only — use alembic in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Rice Mill API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(parties.router,   prefix="/api/parties",   tags=["parties"])
app.include_router(labor.router,     prefix="/api/labor",     tags=["labor"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["reports"])
app.include_router(orders.router,    prefix="/api/orders",    tags=["orders"])
app.include_router(public.router,    prefix="/api/public",    tags=["public"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Rice Mill API"}
