import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from alembic import command
from alembic.config import Config
from routers import infill, pen_types, projects, tool_presets

# Request timeout in seconds (5 minutes for complex operations)
REQUEST_TIMEOUT_SECONDS = 300


class TimeoutMiddleware(BaseHTTPMiddleware):
    """Middleware to timeout long-running requests."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await asyncio.wait_for(call_next(request), timeout=REQUEST_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={"detail": f"Request timeout after {REQUEST_TIMEOUT_SECONDS}s"},
            )


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

# Request timeout middleware (must be added first to wrap everything)
app.add_middleware(TimeoutMiddleware)

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
