"""OpenAI-backed transcript analysis helpers."""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, Field, model_validator

PREFERRED_TOPICS = [
    "billing",
    "refund",
    "subscription",
    "cancellation",
    "technical support",
    "account setup",
    "password reset",
    "shipping",
    "returns",
    "complaint",
]

PREFERRED_KEYWORDS = [
    "frustrated",
    "angry",
    "satisfied",
    "confused",
    "urgent",
    "manager",
    "escalate",
    "cancel",
    "refund",
    "charge",
    "wait",
    "delay",
    "resolved",
    "issue",
]

DEFAULT_ANALYSIS_MODEL = "gpt-5-mini"

KEYWORD_PATTERNS = {
    "frustrated": ["frustrated", "frustrating", "upset", "annoyed"],
    "angry": ["angry", "furious", "mad"],
    "satisfied": ["thank you", "appreciate it", "that worked", "satisfied", "great"],
    "confused": ["not sure", "confused", "do not understand", "don't understand"],
    "urgent": ["urgent", "asap", "right away", "today"],
    "manager": ["manager", "supervisor"],
    "escalate": ["escalate", "escalated", "escalation"],
    "cancel": ["cancel", "cancellation"],
    "refund": ["refund", "money back"],
    "charge": ["charged", "charge", "billing"],
    "wait": ["wait", "waiting", "hold"],
    "delay": ["delay", "delayed", "late"],
    "resolved": ["resolved", "fixed", "that worked", "back in now"],
    "issue": ["issue", "problem", "trouble"],
}

SYSTEM_PROMPT = f"""
Analyze this customer-service call transcript and return only valid JSON.

Use exactly these top-level keys:
- summary: string
- sentiment_score: number from -1.0 to 1.0
- sentiment_label: "positive", "neutral", or "negative"
- top_keywords: array of short strings describing the most important
  interaction techniques, cues, or call signals
- is_resolved: boolean
- topics: array of topic strings
- keywords: object where each key is a matched keyword and each value is boolean true

Rules:
- Do not include any extra keys.
- Keep summary to 2-3 sentences.
- Prefer these topics when they fit: {PREFERRED_TOPICS}
- Prefer these keywords when they fit: {PREFERRED_KEYWORDS}
- For keywords, only use keys from this list: {PREFERRED_KEYWORDS}
- Only include matched keywords with value true.
  Example: {{"refund": true, "charge": true}}
- If there are no matched keywords, return an empty object for keywords.
""".strip()


class AnalysisServiceError(Exception):
    """Raised when transcript analysis fails."""


class TranscriptAnalysisResponse(BaseModel):
    """Exact API contract for transcript analysis responses."""

    summary: str = ""
    sentiment_score: float = 0.0
    sentiment_label: str = "neutral"
    top_keywords: list[str] = Field(default_factory=list)
    is_resolved: bool = False
    topics: list[str] = Field(default_factory=list)
    keywords: dict[str, bool] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> dict[str, Any]:
        """Normalize imperfect model output into the exact response shape."""
        if not isinstance(data, dict):
            raise ValueError("Transcript analysis response must be a JSON object")

        summary = str(data.get("summary", "")).strip()

        raw_score = data.get("sentiment_score", 0.0)
        try:
            sentiment_score = float(raw_score)
        except (TypeError, ValueError):
            sentiment_score = 0.0
        sentiment_score = max(-1.0, min(1.0, sentiment_score))

        raw_label = str(data.get("sentiment_label", "")).strip().lower()
        if raw_label not in {"positive", "neutral", "negative"}:
            if sentiment_score > 0.2:
                raw_label = "positive"
            elif sentiment_score < -0.2:
                raw_label = "negative"
            else:
                raw_label = "neutral"

        raw_top_keywords = data.get("top_keywords", data.get("key_moves", []))
        if isinstance(raw_top_keywords, list):
            top_keywords = [str(item).strip() for item in raw_top_keywords if str(item).strip()]
        else:
            top_keywords = []

        raw_topics = data.get("topics", [])
        if isinstance(raw_topics, list):
            topics = [_normalize_topic(str(item)) for item in raw_topics if str(item).strip()]
        else:
            topics = []

        raw_keywords = data.get("keywords", {})
        keywords = _normalize_keywords(raw_keywords)

        return {
            "summary": summary,
            "sentiment_score": sentiment_score,
            "sentiment_label": raw_label,
            "top_keywords": top_keywords,
            "is_resolved": bool(data.get("is_resolved", False)),
            "topics": topics,
            "keywords": _prune_keywords_for_resolution(
                keywords,
                is_resolved=bool(data.get("is_resolved", False)),
            ),
        }


def format_transcript(transcript: str | list[dict[str, str]]) -> str:
    """Format transcript text for the prompt."""
    if isinstance(transcript, str):
        return transcript.strip()

    lines: list[str] = []
    for turn in transcript:
        speaker = str(turn.get("speaker", "")).strip()
        text = str(turn.get("text", "")).strip()
        if speaker or text:
            lines.append(f"{speaker}: {text}".strip(": "))
    return "\n".join(lines)


def _normalize_topic(topic: str) -> str:
    """Normalize topic casing to match the API examples more closely."""
    cleaned = topic.strip()
    if not cleaned:
        return ""
    return cleaned[0].upper() + cleaned[1:].lower()


def _normalize_keyword_name(keyword: str) -> str:
    """Normalize keyword keys against the preferred keyword list."""
    cleaned = keyword.strip().lower()
    if not cleaned:
        return ""

    for preferred in PREFERRED_KEYWORDS:
        if cleaned == preferred.lower():
            return preferred

    return ""


def _normalize_keywords(raw_keywords: Any) -> dict[str, bool]:
    """Normalize model-provided keywords to the preferred keyword dictionary shape."""
    normalized: dict[str, bool] = {}

    if isinstance(raw_keywords, dict):
        for key, value in raw_keywords.items():
            normalized_key = _normalize_keyword_name(str(key))
            if normalized_key and bool(value):
                normalized[normalized_key] = True
    elif isinstance(raw_keywords, list):
        for item in raw_keywords:
            normalized_key = _normalize_keyword_name(str(item))
            if normalized_key:
                normalized[normalized_key] = True

    return normalized


def _extract_keywords_from_text(transcript_text: str) -> dict[str, bool]:
    """Fallback keyword extraction from transcript text when the model omits them."""
    lowered = transcript_text.lower()
    extracted: dict[str, bool] = {}

    for keyword, patterns in KEYWORD_PATTERNS.items():
        if any(re.search(rf"\b{re.escape(pattern)}\b", lowered) for pattern in patterns):
            extracted[keyword] = True

    return extracted


def _prune_keywords_for_resolution(
    keywords: dict[str, bool],
    *,
    is_resolved: bool,
) -> dict[str, bool]:
    """Keep resolution keywords aligned with the resolved status."""
    pruned = dict(keywords)
    if not is_resolved:
        pruned.pop("resolved", None)
    return pruned


def analyze_transcript_with_openai(
    transcript: str | list[dict[str, str]],
    *,
    model: str,
    api_key: str,
) -> TranscriptAnalysisResponse:
    """Analyze a transcript with OpenAI and normalize the result."""
    if not api_key:
        raise AnalysisServiceError("OpenAI API key is not configured")

    formatted_transcript = format_transcript(transcript)
    if not formatted_transcript:
        raise AnalysisServiceError("Transcript cannot be empty")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise AnalysisServiceError("OpenAI package is not installed") from exc

    client = OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": formatted_transcript},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if not content:
            raise AnalysisServiceError("OpenAI returned an empty response")

        payload = json.loads(content)
    except AnalysisServiceError:
        raise
    except Exception as exc:
        raise AnalysisServiceError("Failed to analyze transcript with OpenAI") from exc

    try:
        result = TranscriptAnalysisResponse.model_validate(payload)
    except Exception as exc:
        raise AnalysisServiceError("OpenAI returned an invalid analysis payload") from exc

    extracted_keywords = _extract_keywords_from_text(formatted_transcript)
    if extracted_keywords:
        result.keywords = _prune_keywords_for_resolution(
            extracted_keywords,
            is_resolved=result.is_resolved,
        )

    return result
