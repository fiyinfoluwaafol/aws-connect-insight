"""Call analysis helpers."""

from supabase import Client

from .constants import Tables
from .decorators import db_operation
from .exceptions import DatabaseError, NotFoundError


@db_operation
def create_analysis(
    client: Client,
    call_id: str,
    summary: str,
    sentiment_score: float,
    sentiment_label: str,
    key_moves: list[str],
    is_resolved: bool,
) -> dict:
    """Create analysis for a call."""
    result = (
        client.table(Tables.CALL_ANALYSES)
        .insert(
            {
                "call_id": call_id,
                "summary": summary,
                "sentiment_score": sentiment_score,
                "sentiment_label": sentiment_label,
                "key_moves": key_moves,
                "is_resolved": is_resolved,
            }
        )
        .execute()
    )
    if not result.data:
        raise DatabaseError("Failed to create analysis")
    return result.data[0]


@db_operation
def upsert_analysis(
    client: Client,
    call_id: str,
    summary: str,
    sentiment_score: float,
    sentiment_label: str,
    key_moves: list[str],
    is_resolved: bool,
) -> dict:
    """
    Create or update analysis for a call.

    This is idempotent - safe to call multiple times for the same call.
    If an analysis already exists for the call_id, it will be updated.
    If not, a new analysis will be created.
    """
    result = (
        client.table(Tables.CALL_ANALYSES)
        .upsert(
            {
                "call_id": call_id,
                "summary": summary,
                "sentiment_score": sentiment_score,
                "sentiment_label": sentiment_label,
                "key_moves": key_moves,
                "is_resolved": is_resolved,
            },
            on_conflict="call_id",
        )
        .execute()
    )
    if not result.data:
        raise DatabaseError("Failed to upsert analysis")
    return result.data[0]


@db_operation
def get_analysis_by_call_id(client: Client, call_id: str) -> dict:
    """Get analysis for a call, including topics and keywords."""
    result = (
        client.table(Tables.CALL_ANALYSES)
        .select(
            f"*, {Tables.CALL_ANALYSIS_TOPICS}({Tables.TOPICS}(name)), "
            f"{Tables.CALL_ANALYSIS_KEYWORDS}({Tables.KEYWORDS}(word))"
        )
        .eq("call_id", call_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError(f"Analysis for call {call_id} not found")

    analysis = result.data[0]

    # Flatten topics to list of names
    raw_topics = analysis.pop(Tables.CALL_ANALYSIS_TOPICS, [])
    analysis["topics"] = [t[Tables.TOPICS]["name"] for t in raw_topics]

    # Flatten keywords to list of words
    raw_keywords = analysis.pop(Tables.CALL_ANALYSIS_KEYWORDS, [])
    analysis["keywords"] = [k[Tables.KEYWORDS]["word"] for k in raw_keywords]

    return analysis


@db_operation
def get_analyses_by_call_ids(client: Client, call_ids: list[str]) -> list[dict]:
    """
    Get analyses for multiple calls in a single query.

    Returns a list of analyses with their topics and keywords.
    Calls without analyses are omitted from the result.
    """
    if not call_ids:
        return []

    result = (
        client.table(Tables.CALL_ANALYSES)
        .select(
            f"*, {Tables.CALL_ANALYSIS_TOPICS}({Tables.TOPICS}(name)), "
            f"{Tables.CALL_ANALYSIS_KEYWORDS}({Tables.KEYWORDS}(word))"
        )
        .in_("call_id", call_ids)
        .execute()
    )

    analyses = []
    for analysis in result.data or []:
        # Flatten topics to list of names
        raw_topics = analysis.pop(Tables.CALL_ANALYSIS_TOPICS, [])
        analysis["topics"] = [t[Tables.TOPICS]["name"] for t in raw_topics]

        # Flatten keywords to list of words
        raw_keywords = analysis.pop(Tables.CALL_ANALYSIS_KEYWORDS, [])
        analysis["keywords"] = [k[Tables.KEYWORDS]["word"] for k in raw_keywords]

        analyses.append(analysis)

    return analyses


@db_operation
def update_analysis(client: Client, analysis_id: str, **fields) -> dict:
    """Update analysis fields."""
    if not fields:
        raise ValueError("No fields to update")

    result = client.table(Tables.CALL_ANALYSES).update(fields).eq("id", analysis_id).execute()
    if not result.data:
        raise NotFoundError(f"Analysis {analysis_id} not found")
    return result.data[0]


@db_operation
def create_topic(client: Client, name: str) -> dict:
    """Create or get existing topic. Name is normalized to lowercase."""
    normalized = name.strip().lower()

    result = client.table(Tables.TOPICS).upsert({"name": normalized}, on_conflict="name").execute()
    if not result.data:
        raise DatabaseError(f"Failed to create topic: {normalized}")
    return result.data[0]


@db_operation
def create_keyword(client: Client, word: str) -> dict:
    """Create or get existing keyword. Word is normalized to lowercase."""
    normalized = word.strip().lower()

    result = (
        client.table(Tables.KEYWORDS).upsert({"word": normalized}, on_conflict="word").execute()
    )
    if not result.data:
        raise DatabaseError(f"Failed to create keyword: {normalized}")
    return result.data[0]


@db_operation
def add_topics_to_analysis(client: Client, analysis_id: str, topic_names: list[str]) -> list[dict]:
    """Add topics to an analysis. Creates topics if they don't exist."""
    # Normalize and remove duplicates
    unique_names = list(set(name.strip().lower() for name in topic_names))

    topics = []
    for name in unique_names:
        topic = create_topic(client, name)
        topics.append(topic)

        client.table(Tables.CALL_ANALYSIS_TOPICS).upsert(
            {"call_analysis_id": analysis_id, "topic_id": topic["id"]},
            on_conflict="call_analysis_id,topic_id",
        ).execute()

    return topics


@db_operation
def add_keywords_to_analysis(client: Client, analysis_id: str, keywords: list[str]) -> list[dict]:
    """Add keywords to an analysis. Creates keywords if they don't exist."""
    # Normalize and remove duplicates
    unique_words = list(set(word.strip().lower() for word in keywords))

    keyword_records = []
    for word in unique_words:
        keyword = create_keyword(client, word)
        keyword_records.append(keyword)

        client.table(Tables.CALL_ANALYSIS_KEYWORDS).upsert(
            {"call_analysis_id": analysis_id, "keyword_id": keyword["id"]},
            on_conflict="call_analysis_id,keyword_id",
        ).execute()

    return keyword_records
