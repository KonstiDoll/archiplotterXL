from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command

from routers import pen_types, tool_presets, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run database migrations on startup."""
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    yield


app = FastAPI(
    title="ArchiSlicer API",
    description="Backend API for ArchiSlicer pen plotter",
    version="0.5.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pen_types.router)
app.include_router(tool_presets.router)
app.include_router(projects.router)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "ok", "service": "ArchiSlicer API"}
