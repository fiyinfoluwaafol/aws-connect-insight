"""Transcript analysis endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from api.config import Settings, get_settings
from services.transcript_analysis import (
    DEFAULT_ANALYSIS_MODEL,
    AnalysisServiceError,
    TranscriptAnalysisResponse,
    analyze_transcript_with_openai,
)

router = APIRouter()


class TranscriptTurn(BaseModel):
    """A single transcript turn."""

    speaker: str = Field(min_length=1)
    text: str = Field(min_length=1)


class AnalyzeTranscriptRequest(BaseModel):
    """Request payload for transcript analysis."""

    transcript: str | list[TranscriptTurn]
    model: str = Field(default=DEFAULT_ANALYSIS_MODEL, min_length=1)

    @field_validator("transcript")
    @classmethod
    def validate_transcript(cls, value: str | list[TranscriptTurn]) -> str | list[TranscriptTurn]:
        """Ensure transcript content is not empty."""
        if isinstance(value, str) and not value.strip():
            raise ValueError("Transcript cannot be empty")
        if isinstance(value, list) and not value:
            raise ValueError("Transcript cannot be empty")
        return value


@router.post("", response_model=TranscriptAnalysisResponse)
def analyze_transcript(
    request: AnalyzeTranscriptRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> TranscriptAnalysisResponse:
    """Analyze a transcript with the chosen OpenAI model."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analysis service unavailable",
        )

    try:
        transcript_payload: str | list[dict[str, str]]
        if isinstance(request.transcript, str):
            transcript_payload = request.transcript
        else:
            transcript_payload = [turn.model_dump() for turn in request.transcript]

        return analyze_transcript_with_openai(
            transcript_payload,
            model=request.model,
            api_key=settings.openai_api_key,
        )
    except AnalysisServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
