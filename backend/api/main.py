"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from api.config import get_settings
from api.routers import agent, alerts, analysis, auth, calls, dashboard, health, teams, twilio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup/shutdown hooks."""
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="AWS Connect Insight API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Behind Railway et al., clients use HTTPS but the hop to the container may be HTTP.
    # Trust X-Forwarded-Proto so `request.url` matches Twilio's signed webhook URL.
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
    app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
    app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
    app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
    app.include_router(teams.router, prefix="/api/teams", tags=["teams"])
    app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
    app.include_router(twilio.router, prefix="/api/twilio", tags=["twilio"])
    return app


app = create_app()
