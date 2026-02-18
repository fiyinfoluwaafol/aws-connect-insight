"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup/shutdown hooks."""
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="AWS Connect Insight API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.include_router(health.router, prefix="/health", tags=["health"])
    return app


app = create_app()
