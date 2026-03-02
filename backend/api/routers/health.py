"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}
