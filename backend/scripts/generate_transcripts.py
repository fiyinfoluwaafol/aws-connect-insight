#!/usr/bin/env python3
"""OpenAI transcript batch generator with sentiment-bucket JSON outputs."""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

RISK_CLASSES = ("normal", "mild", "high", "coaching")
SENTIMENT_LABELS = ("negative", "neutral", "positive")
DEFAULT_TOPICS = [
    "billing",
    "shipping",
    "returns",
    "account",
    "subscription",
    "technical",
    "fraud",
    "loyalty",
]
DEFAULT_RISK_SPLIT = "60,25,10,5"
FIXED_SEEDED_ANCHOR = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

HIGH_KEYWORDS = ["cancel", "chargeback", "dispute", "lawsuit"]
MILD_KEYWORDS = ["refund", "complaint"]

POSITIVE_LEXICON = {
    "appreciate",
    "clear",
    "easy",
    "excellent",
    "fair",
    "glad",
    "good",
    "great",
    "helpful",
    "perfect",
    "quick",
    "quickly",
    "relief",
    "resolved",
    "smooth",
    "thanks",
    "thank",
    "understand",
    "understood",
}

NEGATIVE_LEXICON = {
    "angry",
    "awful",
    "bad",
    "cancel",
    "chargeback",
    "complaint",
    "dispute",
    "fraud",
    "frustrated",
    "horrible",
    "lawsuit",
    "outrageous",
    "problem",
    "refund",
    "ridiculous",
    "scam",
    "stress",
    "terrible",
    "unacceptable",
    "unresolved",
    "upset",
    "waiting",
    "worst",
}

CALL_ID_RE = re.compile(r"^call_(\d+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate call transcripts with OpenAI and save into sentiment JSON files."
    )
    parser.add_argument("--count", type=int, default=20, help="Number of transcripts to generate.")
    parser.add_argument(
        "--seed", type=str, default=None, help="Optional seed for deterministic specs."
    )
    parser.add_argument(
        "--date-range-days",
        type=int,
        default=30,
        help="Generate createdAt within this many days before anchor date.",
    )
    parser.add_argument(
        "--end-date",
        type=str,
        default=None,
        help="Optional ISO datetime anchor (UTC assumed if timezone omitted).",
    )
    parser.add_argument(
        "--risk-split",
        type=str,
        default=DEFAULT_RISK_SPLIT,
        help="Comma-separated percentages normal,mild,high,coaching.",
    )
    parser.add_argument("--model", type=str, default="gpt-4.1-mini", help="OpenAI model.")
    parser.add_argument("--temperature", type=float, default=0.6, help="OpenAI temperature.")
    parser.add_argument("--min-turns", type=int, default=10, help="Minimum transcript turns.")
    parser.add_argument("--max-turns", type=int, default=18, help="Maximum transcript turns.")
    parser.add_argument(
        "--max-retries",
        type=int,
        default=2,
        help="Retries per transcript on API/parse failure.",
    )
    parser.add_argument(
        "--retry-backoff-ms",
        type=int,
        default=500,
        help="Linear retry backoff in milliseconds.",
    )
    parser.add_argument(
        "--topics",
        type=str,
        default=",".join(DEFAULT_TOPICS),
        help="Comma-separated topic list.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./outputs",
        help="Directory for output JSON files.",
    )
    parser.add_argument(
        "--include-all",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Write optional all.json file (default: true).",
    )
    parser.add_argument(
        "--reset-output",
        action="store_true",
        help="Reset output files to empty arrays before generation.",
    )

    args = parser.parse_args()

    if args.count <= 0:
        parser.error("--count must be > 0")
    if args.date_range_days < 0:
        parser.error("--date-range-days must be >= 0")
    if args.min_turns < 2:
        parser.error("--min-turns must be >= 2")
    if args.max_turns < args.min_turns:
        parser.error("--max-turns must be >= --min-turns")
    if args.max_retries < 0:
        parser.error("--max-retries must be >= 0")
    if args.retry_backoff_ms < 0:
        parser.error("--retry-backoff-ms must be >= 0")

    return args


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return

    for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[len("export ") :]

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if not key:
            continue

        if value and value[0] in {'"', "'"} and value[-1] == value[0]:
            value = value[1:-1]

        if key not in os.environ:
            os.environ[key] = value


def parse_topics(raw_topics: str) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()

    for topic in raw_topics.split(","):
        cleaned = topic.strip().lower()
        if not cleaned:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        topics.append(cleaned)

    if not topics:
        raise ValueError("At least one topic is required.")

    return topics


def parse_iso_datetime(value: str) -> datetime:
    cleaned = value.strip()
    if cleaned.endswith("Z"):
        cleaned = f"{cleaned[:-1]}+00:00"

    dt = datetime.fromisoformat(cleaned)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt


def format_iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_risk_split(raw: str) -> dict[str, float]:
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    if len(parts) != 4:
        raise ValueError(
            "--risk-split must have 4 comma-separated values (normal,mild,high,coaching)."
        )

    values: list[float] = []
    for part in parts:
        value = float(part)
        if value < 0:
            raise ValueError("--risk-split values must be >= 0")
        values.append(value)

    total = sum(values)
    if total <= 0:
        raise ValueError("--risk-split total must be > 0")

    return dict(zip(RISK_CLASSES, values))


def compute_risk_counts(total_count: int, split: dict[str, float]) -> dict[str, int]:
    total_weight = sum(split.values())
    exact_counts = [total_count * (split[risk] / total_weight) for risk in RISK_CLASSES]
    base_counts = [math.floor(value) for value in exact_counts]

    allocated = sum(base_counts)
    remaining = total_count - allocated

    order = sorted(
        range(len(RISK_CLASSES)),
        key=lambda idx: (exact_counts[idx] - base_counts[idx], -idx),
        reverse=True,
    )

    for idx in order[:remaining]:
        base_counts[idx] += 1

    return {risk: base_counts[idx] for idx, risk in enumerate(RISK_CLASSES)}


def make_risk_sequence(counts: dict[str, int], rng: random.Random) -> list[str]:
    sequence: list[str] = []
    for risk in RISK_CLASSES:
        sequence.extend([risk] * counts[risk])
    rng.shuffle(sequence)
    return sequence


def choose_anchor_date(seed: str | None, end_date: str | None) -> datetime:
    if end_date:
        return parse_iso_datetime(end_date)
    if seed is not None:
        return FIXED_SEEDED_ANCHOR
    return datetime.now(timezone.utc)


def choose_required_keywords(risk_class: str, rng: random.Random) -> list[str]:
    if risk_class == "high":
        return [rng.choice(HIGH_KEYWORDS)]
    if risk_class == "mild":
        return [rng.choice(MILD_KEYWORDS)]
    if risk_class == "coaching" and rng.random() < 0.35:
        return [rng.choice(MILD_KEYWORDS)]
    return []


def risk_style_hint(risk_class: str) -> str:
    if risk_class == "high":
        return "Customer is highly upset. Likely unresolved or only partially resolved. Escalation tone is realistic."
    if risk_class == "mild":
        return "Customer is somewhat frustrated but conversation can still de-escalate and often resolves."
    if risk_class == "coaching":
        return (
            "Include a clear coaching opportunity in the agent behavior (e.g., interruption, robotic wording, "
            "missed empathy, or unnecessary back-and-forth)."
        )
    return "Routine call, mostly smooth interaction, usually resolved."


def risk_sentiment_hint(risk_class: str) -> str:
    if risk_class == "high":
        return (
            "Customer sentiment target: clearly negative. Use frustrated or upset wording,"
            " and avoid ending on an overly positive tone."
        )
    if risk_class == "mild":
        return (
            "Customer sentiment target: mildly negative to neutral. Include some friction,"
            " but do not make it extreme."
        )
    if risk_class == "coaching":
        return (
            "Customer sentiment target: mixed, often neutral to mildly negative,"
            " with a clear coaching opportunity in agent behavior."
        )
    return (
        "Customer sentiment target: neutral to slightly positive."
        " Keep the exchange routine and stable."
    )


def build_call_spec(
    index: int,
    risk_class: str,
    topics: list[str],
    rng: random.Random,
    anchor: datetime,
    date_range_days: int,
    min_turns: int,
    max_turns: int,
) -> dict[str, Any]:
    if date_range_days == 0:
        created_at = anchor
    else:
        max_seconds = max(1, date_range_days * 24 * 60 * 60)
        offset_seconds = rng.randint(0, max_seconds)
        offset_millis = rng.randint(0, 999)
        created_at = anchor - timedelta(seconds=offset_seconds, milliseconds=offset_millis)

    return {
        "id": f"call_{index:06d}",
        "createdAt": format_iso_z(created_at),
        "topic": rng.choice(topics),
        "riskClass": risk_class,
        "targetTurns": rng.randint(min_turns, max_turns),
        "requiredKeywords": choose_required_keywords(risk_class, rng),
    }


def build_prompt(spec: dict[str, Any]) -> str:
    required_keywords = spec["requiredKeywords"]
    keyword_line = (
        f"Required keywords to include naturally at least once: {', '.join(required_keywords)}."
        if required_keywords
        else "No required escalation keywords. Keep language natural for the scenario."
    )

    normal_keyword_warning = ""
    if spec["riskClass"] == "normal":
        normal_keyword_warning = "Avoid using these escalation words unless absolutely necessary: cancel, chargeback, dispute, lawsuit."

    return (
        "Generate a realistic customer support call transcript.\n"
        "Return ONLY a top-level JSON array, with no markdown and no extra text.\n"
        'Every array item must be exactly: {"speaker":"Customer"|"Agent","text":"..."}.\n'
        f"Use exactly {spec['targetTurns']} turns.\n"
        "Turns must alternate speakers and start with Customer.\n"
        f"Topic: {spec['topic']}.\n"
        f"Risk class: {spec['riskClass']}.\n"
        f"Style guidance: {risk_style_hint(spec['riskClass'])}\n"
        f"{risk_sentiment_hint(spec['riskClass'])}\n"
        f"{keyword_line}\n"
        f"{normal_keyword_warning}\n"
        "Use natural spoken phrasing, occasional filler words, and realistic call-center tone."
    )


def extract_output_text(response_obj: dict[str, Any]) -> str:
    output_text = response_obj.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    if isinstance(output_text, list):
        combined = "".join(str(piece) for piece in output_text).strip()
        if combined:
            return combined

    parts: list[str] = []
    output = response_obj.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if isinstance(content, list):
                for block in content:
                    if not isinstance(block, dict):
                        continue
                    text_value = block.get("text")
                    if isinstance(text_value, str):
                        parts.append(text_value)

    if parts:
        return "".join(parts).strip()

    choices = response_obj.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message", {})
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()
                if isinstance(content, list):
                    message_parts: list[str] = []
                    for piece in content:
                        if isinstance(piece, dict) and isinstance(piece.get("text"), str):
                            message_parts.append(piece["text"])
                    combined = "".join(message_parts).strip()
                    if combined:
                        return combined

    raise ValueError("Could not extract text output from OpenAI response.")


def call_openai_responses(
    api_key: str,
    model: str,
    temperature: float,
    prompt: str,
    target_turns: int,
) -> str:
    payload = {
        "model": model,
        "temperature": temperature,
        "max_output_tokens": max(600, target_turns * 120),
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": "You generate synthetic call transcript turns and follow output format exactly.",
                    }
                ],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            },
        ],
    }

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url="https://api.openai.com/v1/responses",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            response_json = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        error_body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI HTTP {err.code}: {error_body}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"OpenAI request failed: {err.reason}") from err

    return extract_output_text(response_json)


def extract_first_json_array(raw_text: str) -> str | None:
    start_idx = raw_text.find("[")
    if start_idx == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for idx in range(start_idx, len(raw_text)):
        ch = raw_text[idx]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return raw_text[start_idx : idx + 1]

    return None


def validate_turns(data: Any) -> list[dict[str, str]]:
    if not isinstance(data, list):
        raise ValueError("Transcript output must be a top-level JSON array.")

    normalized: list[dict[str, str]] = []
    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"Turn {idx} is not an object.")

        speaker = item.get("speaker")
        text = item.get("text")

        if speaker not in {"Customer", "Agent"}:
            raise ValueError(f"Turn {idx} has invalid speaker: {speaker!r}")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"Turn {idx} has empty text.")

        normalized.append({"speaker": speaker, "text": text.strip()})

    if not normalized:
        raise ValueError("Transcript array is empty.")

    return normalized


def parse_turns(raw_text: str) -> list[dict[str, str]]:
    try:
        parsed = json.loads(raw_text)
        return validate_turns(parsed)
    except json.JSONDecodeError:
        extracted = extract_first_json_array(raw_text)
        if extracted is None:
            raise ValueError("Could not find a JSON array in model output.")
        parsed = json.loads(extracted)
        return validate_turns(parsed)


def normalize_turn_count(
    turns: list[dict[str, str]],
    target_turns: int,
    tolerance: int | None = None,
) -> list[dict[str, str]]:
    diff = len(turns) - target_turns
    if diff == 0:
        return turns
    if tolerance is not None and abs(diff) > tolerance:
        raise ValueError(f"Expected {target_turns} turns (±{tolerance}), got {len(turns)}.")

    if diff > 0:
        return turns[:target_turns]

    normalized = list(turns)
    while len(normalized) < target_turns:
        last_speaker = normalized[-1]["speaker"] if normalized else "Agent"
        if last_speaker == "Customer":
            next_turn = {
                "speaker": "Agent",
                "text": "I understand. I can help with that and move this forward now.",
            }
        else:
            next_turn = {
                "speaker": "Customer",
                "text": "Okay, I understand. Please go ahead.",
            }
        normalized.append(next_turn)
    return normalized


def build_full_text(turns: list[dict[str, str]]) -> str:
    return "\n".join(f"{turn['speaker']}: {turn['text']}" for turn in turns)


def score_sentiment_customer_only(turns: list[dict[str, str]]) -> tuple[float, str]:
    customer_text = " ".join(turn["text"] for turn in turns if turn["speaker"] == "Customer")
    tokens = re.findall(r"[a-zA-Z']+", customer_text.lower())

    positive_hits = sum(1 for token in tokens if token in POSITIVE_LEXICON)
    negative_hits = sum(1 for token in tokens if token in NEGATIVE_LEXICON)

    if positive_hits == 0 and negative_hits == 0:
        score = 0.0
    else:
        score = (positive_hits - negative_hits) / (positive_hits + negative_hits)

    score = max(-1.0, min(1.0, score))
    score = round(score, 3)

    if score < -0.2:
        label = "negative"
    elif score <= 0.2:
        label = "neutral"
    else:
        label = "positive"

    return score, label


def read_json_array(path: Path) -> list[Any]:
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise RuntimeError(f"Invalid JSON found in {path}") from err

    if not isinstance(payload, list):
        raise RuntimeError(f"Expected JSON array in {path}")

    return payload


def write_json_atomic(path: Path, payload: list[Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        delete=False,
        dir=path.parent,
        prefix=f"{path.stem}.",
        suffix=".tmp",
    ) as tmp_file:
        json.dump(payload, tmp_file, ensure_ascii=False, indent=2)
        tmp_file.write("\n")
        tmp_name = tmp_file.name

    os.replace(tmp_name, path)


def append_record(path: Path, record: dict[str, Any]) -> None:
    current = read_json_array(path)
    current.append(record)
    write_json_atomic(path, current)


def next_call_index(paths: list[Path]) -> int:
    max_id = 0
    for path in paths:
        records = read_json_array(path)
        for record in records:
            if not isinstance(record, dict):
                continue
            raw_id = record.get("id")
            if not isinstance(raw_id, str):
                continue
            match = CALL_ID_RE.match(raw_id)
            if not match:
                continue
            max_id = max(max_id, int(match.group(1)))
    return max_id + 1


def initialize_output_files(paths: list[Path], reset_output: bool) -> None:
    if not reset_output:
        return

    for path in paths:
        write_json_atomic(path, [])


def generate_with_retries(
    api_key: str,
    model: str,
    temperature: float,
    spec: dict[str, Any],
    max_retries: int,
    retry_backoff_ms: int,
) -> list[dict[str, str]]:
    attempts = max_retries + 1
    last_err: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            prompt = build_prompt(spec)
            raw_text = call_openai_responses(
                api_key=api_key,
                model=model,
                temperature=temperature,
                prompt=prompt,
                target_turns=spec["targetTurns"],
            )
            turns = parse_turns(raw_text)
            turns = normalize_turn_count(turns, spec["targetTurns"])
            return turns
        except Exception as err:  # noqa: BLE001
            last_err = err
            if attempt == attempts:
                break
            sleep_s = (retry_backoff_ms * attempt) / 1000.0
            print(
                f"  attempt {attempt}/{attempts} failed for {spec['id']}: {err}. "
                f"Retrying in {sleep_s:.2f}s..."
            )
            time.sleep(sleep_s)

    raise RuntimeError(f"All attempts failed for {spec['id']}: {last_err}")


def main() -> int:
    args = parse_args()

    load_dotenv(Path(".env"))
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(
            "ERROR: OPENAI_API_KEY is not set. Add it to your environment or .env file.",
            file=sys.stderr,
        )
        return 1

    try:
        topics = parse_topics(args.topics)
        risk_split = parse_risk_split(args.risk_split)
    except ValueError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1

    rng = random.Random(args.seed) if args.seed is not None else random.Random()
    try:
        anchor = choose_anchor_date(args.seed, args.end_date)
    except ValueError as err:
        print(f"ERROR: invalid --end-date: {err}", file=sys.stderr)
        return 1

    risk_counts = compute_risk_counts(args.count, risk_split)
    risk_sequence = make_risk_sequence(risk_counts, rng)

    output_dir = Path(args.output_dir).resolve()
    sentiment_paths = {
        "negative": output_dir / "negative.json",
        "neutral": output_dir / "neutral.json",
        "positive": output_dir / "positive.json",
    }
    all_path = output_dir / "all.json"

    paths_to_init = list(sentiment_paths.values())
    if args.include_all:
        paths_to_init.append(all_path)
    initialize_output_files(paths_to_init, args.reset_output)
    try:
        start_id_index = next_call_index([*sentiment_paths.values(), all_path])
    except RuntimeError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print("Starting generation with settings:")
    print(f"  count={args.count}, model={args.model}, temperature={args.temperature}")
    print(
        f"  seed={args.seed!r}, date_range_days={args.date_range_days}, anchor={format_iso_z(anchor)}"
    )
    print(f"  risk_split={args.risk_split} -> counts={risk_counts}")
    print(f"  output_dir={output_dir}")
    print(f"  id_start=call_{start_id_index:06d}")

    saved_counts = {label: 0 for label in SENTIMENT_LABELS}
    success_count = 0
    failed_count = 0

    for position in range(args.count):
        idx = start_id_index + position
        risk_class = risk_sequence[position]
        spec = build_call_spec(
            index=idx,
            risk_class=risk_class,
            topics=topics,
            rng=rng,
            anchor=anchor,
            date_range_days=args.date_range_days,
            min_turns=args.min_turns,
            max_turns=args.max_turns,
        )

        print(
            f"[{position + 1}/{args.count}] generating {spec['id']} "
            f"topic={spec['topic']} risk={spec['riskClass']} turns={spec['targetTurns']}"
        )

        try:
            turns = generate_with_retries(
                api_key=api_key,
                model=args.model,
                temperature=args.temperature,
                spec=spec,
                max_retries=args.max_retries,
                retry_backoff_ms=args.retry_backoff_ms,
            )
        except Exception as err:  # noqa: BLE001
            failed_count += 1
            print(f"  FAILED {spec['id']}: {err}")
            continue

        full_text = build_full_text(turns)
        sentiment_score, sentiment_label = score_sentiment_customer_only(turns)

        record = {
            "id": spec["id"],
            "createdAt": spec["createdAt"],
            "topic": spec["topic"],
            "riskClass": spec["riskClass"],
            "sentimentScore": sentiment_score,
            "sentimentLabel": sentiment_label,
            "transcript": {
                "turns": turns,
                "fullText": full_text,
            },
        }

        target_path = sentiment_paths[sentiment_label]
        try:
            append_record(target_path, record)
            if args.include_all:
                append_record(all_path, record)
        except Exception as err:  # noqa: BLE001
            failed_count += 1
            print(f"  FAILED to write {spec['id']}: {err}")
            continue

        success_count += 1
        saved_counts[sentiment_label] += 1
        print(
            f"  saved {spec['id']} -> {target_path.name} "
            f"(sentiment={sentiment_label}, score={sentiment_score})"
        )

    print("\nRun complete:")
    print(f"  success={success_count}")
    print(f"  failed={failed_count}")
    for label in SENTIMENT_LABELS:
        print(f"  {label}={saved_counts[label]}")
    if args.include_all:
        print(f"  all={success_count}")

    print("Output files:")
    for label in SENTIMENT_LABELS:
        print(f"  {sentiment_paths[label]}")
    if args.include_all:
        print(f"  {all_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
