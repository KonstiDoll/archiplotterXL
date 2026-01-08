from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command

from routers import pen_types, tool_presets, projects, infill


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database migrations on startup."""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    yield


app = FastAPI(
    title="ArchiSlicer API",
    description="Backend API for ArchiSlicer pen plotter",
    version="0.6.1",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Vite dev server (alternate port)
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pen_types.router)
app.include_router(tool_presets.router)
app.include_router(projects.router)
app.include_router(infill.router)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "ok", "service": "ArchiSlicer API"}


@app.get("/api/")
def api_root():
    """API health check endpoint for Caddy proxy."""
    return {"status": "ok", "service": "ArchiSlicer API", "version": "0.6.1"}
