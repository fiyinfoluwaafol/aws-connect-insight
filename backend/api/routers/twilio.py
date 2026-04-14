"""Twilio webhook endpoints for real call ingestion."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from api.config import Settings, get_settings
from api.dependencies import get_supabase_client
from api.routers.calls import normalize_transcript
from database.analysis import (
    add_keywords_to_analysis,
    add_topics_to_analysis,
    create_analysis,
)
from database.calls import create_call
from database.exceptions import NotFoundError
from database.teams import get_team_by_id
from database.users import get_user_by_email
from services.alerts import evaluate_alert_rules_for_call
from services.transcript_analysis import (
    DEFAULT_ANALYSIS_MODEL,
    analyze_transcript_with_openai,
)
from services.twilio_transcription import TranscriptionError, transcribe_recording

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory SSE event bus (single-server, fine for demo)
# ---------------------------------------------------------------------------
_event_queues: list[asyncio.Queue] = []


def _broadcast_event(event_type: str, data: dict | None = None) -> None:
    """Push an SSE event to all connected clients."""
    payload = json.dumps({"type": event_type, **(data or {})})
    for queue in _event_queues:
        queue.put_nowait(payload)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_supabase_client_direct(settings: Settings) -> Any:
    """Create a fresh Supabase client for background tasks."""
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def _twilio_proxy_headers_for_log(request: Request) -> dict[str, str]:
    """Forwarded / host headers (no secrets) — compare to Twilio's signed public URL."""
    h = request.headers
    keys = (
        "host",
        "x-forwarded-proto",
        "x-forwarded-host",
        "x-forwarded-for",
        "x-real-ip",
    )
    return {k: h[k] for k in keys if k in h}


def _validate_twilio_signature(
    request: Request,
    form_data: dict[str, str],
    auth_token: str,
) -> bool:
    """Validate the X-Twilio-Signature header."""
    url = str(request.url)
    proxy_headers = _twilio_proxy_headers_for_log(request)

    try:
        from twilio.request_validator import RequestValidator
    except ImportError:
        logger.error(
            "twilio package is not installed — cannot validate signature url=%s proxy_headers=%s",
            url,
            proxy_headers,
        )
        return False

    validator = RequestValidator(auth_token)
    signature = request.headers.get("X-Twilio-Signature", "")
    valid = validator.validate(url, form_data, signature)

    log_fn = logger.info if valid else logger.warning
    log_fn(
        "Twilio signature check url=%s proxy_headers=%s signature_present=%s valid=%s",
        url,
        proxy_headers,
        bool(signature),
        valid,
    )
    return valid


def _resolve_demo_agent(db_client: Any, email: str) -> tuple[str, str]:
    """Look up the demo agent by email and return (agent_id, team_id)."""
    user = get_user_by_email(db_client, email)
    agent_id = user["id"]
    team_id = user.get("team_id")
    if not team_id:
        raise NotFoundError(f"Demo agent {email} is not assigned to a team")
    return agent_id, team_id


def _process_recording(
    recording_url: str,
    recording_duration: int,
    call_sid: str,
    settings: Settings,
) -> None:
    """Background task: download, transcribe, analyse, and store a call."""
    try:
        # Stage 1: Downloading recording
        _broadcast_event("call_processing", {"stage": "downloading", "call_sid": call_sid})
        raw_turns = transcribe_recording(
            recording_url=recording_url,
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
            openai_api_key=settings.openai_api_key,
        )
        transcript = normalize_transcript(raw_turns)
        if not transcript:
            logger.error("Transcription produced no usable turns for call %s", call_sid)
            _broadcast_event("call_error", {"call_sid": call_sid, "error": "Empty transcript"})
            return

        # Stage 2: Creating call record
        _broadcast_event("call_processing", {"stage": "analyzing", "call_sid": call_sid})
        db_client = _get_supabase_client_direct(settings)
        agent_id, team_id = _resolve_demo_agent(db_client, settings.twilio_demo_agent_email)

        call = create_call(
            db_client,
            agent_id=agent_id,
            team_id=team_id,
            recording_url=recording_url,
            duration_seconds=recording_duration,
            started_at=datetime.now(timezone.utc).isoformat(),
            transcript=transcript,
        )
        logger.info("Created call %s for Twilio call SID %s", call["id"], call_sid)

        # Stage 3: Running analysis
        _broadcast_event("call_processing", {"stage": "saving", "call_sid": call_sid})
        analysis_result = analyze_transcript_with_openai(
            transcript,
            model=DEFAULT_ANALYSIS_MODEL,
            api_key=settings.openai_api_key,
        )

        analysis = create_analysis(
            db_client,
            call_id=call["id"],
            summary=analysis_result.summary,
            sentiment_score=analysis_result.sentiment_score,
            sentiment_label=analysis_result.sentiment_label,
            key_moves=analysis_result.key_moves,
            is_resolved=analysis_result.is_resolved,
        )

        if analysis_result.topics:
            add_topics_to_analysis(db_client, analysis["id"], analysis_result.topics)
        if analysis_result.keywords:
            add_keywords_to_analysis(
                db_client,
                analysis["id"],
                list(analysis_result.keywords.keys()),
            )

        # Stage 4: Evaluate alerts
        try:
            team = get_team_by_id(db_client, team_id)
            supervisor_id = team.get("supervisor_id")
            if supervisor_id:
                evaluate_alert_rules_for_call(
                    db_client,
                    team_id=team_id,
                    supervisor_id=supervisor_id,
                    call_id=call["id"],
                    started_at=call["started_at"],
                    sentiment_score=analysis_result.sentiment_score,
                    topics=analysis_result.topics,
                    keywords=analysis_result.keywords,
                )
        except Exception:  # noqa: BLE001 - alerting must not block ingestion
            logger.exception("Alert evaluation failed for call %s", call["id"])

        # Broadcast completion with call data
        _broadcast_event(
            "call_complete",
            {
                "call_sid": call_sid,
                "call_id": call["id"],
                "summary": analysis_result.summary,
                "sentiment_score": analysis_result.sentiment_score,
                "sentiment_label": analysis_result.sentiment_label,
                "topics": analysis_result.topics,
                "is_resolved": analysis_result.is_resolved,
            },
        )
        logger.info("Twilio call %s fully processed (call %s)", call_sid, call["id"])

    except TranscriptionError:
        logger.exception("Transcription failed for Twilio call %s", call_sid)
        _broadcast_event("call_error", {"call_sid": call_sid, "error": "Transcription failed"})
    except Exception:  # noqa: BLE001 - background task must not propagate
        logger.exception("Unexpected error processing Twilio call %s", call_sid)
        _broadcast_event("call_error", {"call_sid": call_sid, "error": "Processing failed"})


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------


@router.get("/events")
async def twilio_events() -> StreamingResponse:
    """Server-Sent Events stream for live call processing updates."""
    queue: asyncio.Queue = asyncio.Queue()
    _event_queues.append(queue)

    async def event_generator():
        try:
            # Send initial keepalive
            yield "event: connected\ndata: {}\n\n"
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: message\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive to prevent connection timeout
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            _event_queues.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Twilio webhook
# ---------------------------------------------------------------------------


@router.post("/recording-status")
async def handle_recording_status(
    request: Request,
    background_tasks: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[Any, Depends(get_supabase_client)],  # noqa: ARG001 - reserved
) -> dict[str, str]:
    """Receive Twilio recording status callbacks and process completed recordings."""
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twilio is not configured",
        )
    if not settings.twilio_demo_agent_email:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Twilio demo agent email is not configured",
        )

    form = await request.form()
    form_data = {key: str(value) for key, value in form.items()}

    if not _validate_twilio_signature(request, form_data, settings.twilio_auth_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature",
        )

    recording_status = form_data.get("RecordingStatus", "")
    if recording_status != "completed":
        logger.debug("Ignoring recording status: %s", recording_status)
        return {"status": "ignored"}

    recording_url = form_data.get("RecordingUrl", "")
    call_sid = form_data.get("CallSid", "")
    try:
        recording_duration = int(form_data.get("RecordingDuration", "0"))
    except ValueError:
        recording_duration = 0

    if not recording_url:
        logger.warning("No RecordingUrl in Twilio callback for call %s", call_sid)
        return {"status": "ignored"}

    logger.info(
        "Queuing processing for Twilio call %s (recording %s, %ds)",
        call_sid,
        form_data.get("RecordingSid", ""),
        recording_duration,
    )

    # Notify connected clients that a call is being processed
    _broadcast_event(
        "call_received",
        {
            "call_sid": call_sid,
            "duration": recording_duration,
        },
    )

    background_tasks.add_task(
        _process_recording,
        recording_url=recording_url,
        recording_duration=recording_duration,
        call_sid=call_sid,
        settings=settings,
    )

    return {"status": "processing"}
