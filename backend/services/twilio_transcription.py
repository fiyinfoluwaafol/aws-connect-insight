"""Twilio recording download and transcription via OpenAI Whisper + GPT."""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_TRANSCRIPTION_MODEL = "whisper-1"
DEFAULT_FORMATTING_MODEL = "gpt-5-mini"

SPEAKER_FORMAT_PROMPT = """
You are given a raw transcript of a customer-service phone call between a
Customer and an Agent. Split it into speaker-attributed turns.

Return a JSON object with a single key "turns" containing an array of objects,
each with "speaker" and "text" keys.

Rules:
- Use exactly two speaker labels: "Customer" and "Agent".
- The Customer is the person who called in with a question or issue.
- The Agent is the support representative helping the Customer.
- Preserve the original wording. Do not summarise or paraphrase.
- Each object represents one uninterrupted turn by that speaker.
- If you cannot confidently separate speakers, make your best guess —
  accuracy is more important than refusing to answer.

Example output:
{"turns": [
  {"speaker": "Agent", "text": "Thank you for calling, how can I help?"},
  {"speaker": "Customer", "text": "Hi, I have a question about my bill."}
]}
""".strip()


class TranscriptionError(Exception):
    """Raised when any step of the transcription pipeline fails."""


def _extract_turns(payload: Any) -> list[dict[str, str]]:
    """Extract a list of speaker turns from various GPT response shapes.

    GPT may return:
    - A plain array: [{speaker, text}, ...]
    - An object wrapping an array: {"transcript": [{speaker, text}, ...]}
    - Nested objects: {"data": {"turns": [...]}}
    - A single turn object: {"speaker": "Agent", "text": "..."}
    """
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        # Check if it's a single turn
        if "speaker" in payload and "text" in payload:
            return [payload]

        # Recursively search for a list of dicts with speaker/text keys
        for value in payload.values():
            result = _extract_turns(value)
            if result:
                return result

    return []


def download_twilio_recording(
    recording_url: str,
    account_sid: str,
    auth_token: str,
) -> bytes:
    """Download a Twilio recording as mp3 bytes.

    Twilio serves recordings at ``<RecordingUrl>.mp3`` behind HTTP Basic Auth.
    """
    url = f"{recording_url}.mp3"
    try:
        resp = httpx.get(url, auth=(account_sid, auth_token), timeout=120, follow_redirects=True)
        resp.raise_for_status()
        return resp.content
    except httpx.HTTPError as exc:
        raise TranscriptionError(f"Failed to download recording from {url}") from exc


def transcribe_with_whisper(
    audio_bytes: bytes,
    api_key: str,
    *,
    model: str = DEFAULT_TRANSCRIPTION_MODEL,
) -> str:
    """Send audio bytes to OpenAI Whisper and return the raw transcript text."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionError("OpenAI package is not installed") from exc

    client = OpenAI(api_key=api_key)

    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "recording.mp3"
        result = client.audio.transcriptions.create(
            model=model,
            file=audio_file,
            response_format="text",
        )
        text = result if isinstance(result, str) else str(result)
        if not text.strip():
            raise TranscriptionError("Whisper returned an empty transcript")
        return text.strip()
    except TranscriptionError:
        raise
    except Exception as exc:
        raise TranscriptionError("Whisper transcription failed") from exc


def format_transcript_with_gpt(
    raw_text: str,
    api_key: str,
    *,
    model: str = DEFAULT_FORMATTING_MODEL,
) -> list[dict[str, str]]:
    """Use GPT to split a flat transcript into speaker-attributed turns."""
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise TranscriptionError("OpenAI package is not installed") from exc

    client = OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SPEAKER_FORMAT_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            raise TranscriptionError("GPT returned an empty response for transcript formatting")

        payload = json.loads(content)
        turns = _extract_turns(payload)
        if not turns:
            logger.error("Could not extract turns from GPT response: %s", content[:500])
            raise TranscriptionError("GPT returned no usable transcript turns")

        return turns
    except TranscriptionError:
        raise
    except Exception as exc:
        raise TranscriptionError("Failed to format transcript with GPT") from exc


def transcribe_recording(
    recording_url: str,
    account_sid: str,
    auth_token: str,
    openai_api_key: str,
) -> list[dict[str, str]]:
    """Full pipeline: download recording → Whisper → GPT speaker formatting."""
    logger.info("Downloading recording from %s", recording_url)
    audio_bytes = download_twilio_recording(recording_url, account_sid, auth_token)
    logger.info("Downloaded %.1f KB, sending to Whisper", len(audio_bytes) / 1024)

    raw_text = transcribe_with_whisper(audio_bytes, openai_api_key)
    logger.info("Whisper transcript: %d chars, formatting with GPT", len(raw_text))

    turns = format_transcript_with_gpt(raw_text, openai_api_key)
    logger.info("GPT produced %d speaker turns", len(turns))

    return turns
