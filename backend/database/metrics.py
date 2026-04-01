"""Historical metrics query helpers.

These functions aggregate call analytics data for dashboard metrics.
Data is computed on the fly from the calls and call_analyses tables.
"""

from collections import defaultdict
from datetime import date

from supabase import Client

from .constants import Tables
from .decorators import db_operation


# Maximum rows to fetch per query. Supabase defaults to 1000.
# For larger datasets, consider pre-computed rollups.
MAX_QUERY_ROWS = 10000


@db_operation
def get_daily_metrics(
    client: Client,
    date_from: date,
    date_to: date,
    team_id: str | None = None,
    agent_id: str | None = None,
) -> list[dict]:
    """
    Get daily aggregated metrics for a date range.

    Joins calls with call_analyses and groups by date.
    Can be filtered by team_id and/or agent_id.

    Note: Limited to MAX_QUERY_ROWS calls. For high-volume teams,
    consider using pre-computed daily rollups instead.

    Args:
        client: Supabase client
        date_from: Start date (inclusive)
        date_to: End date (inclusive)
        team_id: Optional team filter
        agent_id: Optional agent filter

    Returns:
        List of daily metrics, each containing:
        - date: The date string (YYYY-MM-DD)
        - call_count: Number of calls that day
        - avg_sentiment: Average sentiment score (-1.0 to 1.0)
        - avg_duration: Average call duration in seconds
        - negative_call_percent: Percentage of analyzed calls with negative sentiment
    """
    # Build query for calls with their analyses
    query = (
        client.table(Tables.CALLS)
        .select(f"started_at, duration_seconds, agent_id, team_id, {Tables.CALL_ANALYSES}(sentiment_score, sentiment_label)")
        .gte("started_at", date_from.isoformat())
        .lte("started_at", f"{date_to.isoformat()}T23:59:59")
        .limit(MAX_QUERY_ROWS)
    )

    if team_id:
        query = query.eq("team_id", team_id)
    if agent_id:
        query = query.eq("agent_id", agent_id)

    result = query.execute()

    # Group data by date and compute aggregates
    daily_data = defaultdict(lambda: {
        "sentiment_scores": [],
        "durations": [],
        "negative_count": 0,
        "analyzed_count": 0,
        "total_count": 0,
    })

    for call in result.data or []:
        if not call.get("started_at"):
            continue

        # Extract date portion from timestamp (assumes ISO format)
        call_date = call["started_at"][:10]
        day = daily_data[call_date]
        day["total_count"] += 1

        # Get duration if available
        if call.get("duration_seconds") is not None:
            day["durations"].append(call["duration_seconds"])

        # Get analysis data if available
        analysis = call.get(Tables.CALL_ANALYSES)
        if analysis:
            day["analyzed_count"] += 1
            if analysis.get("sentiment_score") is not None:
                day["sentiment_scores"].append(analysis["sentiment_score"])
            if analysis.get("sentiment_label") == "negative":
                day["negative_count"] += 1

    # Convert to output format
    metrics = []
    for call_date in sorted(daily_data.keys()):
        day = daily_data[call_date]
        analyzed = day["analyzed_count"]

        metrics.append({
            "date": call_date,
            "call_count": day["total_count"],
            "avg_sentiment": _safe_average(day["sentiment_scores"]),
            "avg_duration": _safe_average(day["durations"], as_int=True),
            "negative_call_percent": round((day["negative_count"] / analyzed) * 100, 1) if analyzed > 0 else 0.0,
        })

    return metrics


@db_operation
def get_metrics_summary(
    client: Client,
    date_from: date,
    date_to: date,
    team_id: str | None = None,
    agent_id: str | None = None,
) -> dict:
    """
    Get aggregated metrics summary for a date range.

    Returns totals and averages across the entire period (not grouped by day).

    Note: Limited to MAX_QUERY_ROWS calls. For high-volume teams,
    consider using pre-computed daily rollups instead.

    Args:
        client: Supabase client
        date_from: Start date (inclusive)
        date_to: End date (inclusive)
        team_id: Optional team filter
        agent_id: Optional agent filter

    Returns:
        Summary dict containing:
        - total_calls: Total number of calls in the period
        - avg_sentiment: Average sentiment score across all calls
        - avg_duration: Average call duration in seconds
        - negative_call_percent: Percentage of analyzed calls with negative sentiment
        - sentiment_distribution: Count of calls by sentiment label
    """
    # Build query for calls with their analyses
    query = (
        client.table(Tables.CALLS)
        .select(f"started_at, duration_seconds, {Tables.CALL_ANALYSES}(sentiment_score, sentiment_label)")
        .gte("started_at", date_from.isoformat())
        .lte("started_at", f"{date_to.isoformat()}T23:59:59")
        .limit(MAX_QUERY_ROWS)
    )

    if team_id:
        query = query.eq("team_id", team_id)
    if agent_id:
        query = query.eq("agent_id", agent_id)

    result = query.execute()

    # Aggregate all data
    sentiment_scores = []
    durations = []
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    total_calls = 0
    analyzed_calls = 0

    for call in result.data or []:
        if not call.get("started_at"):
            continue

        total_calls += 1

        if call.get("duration_seconds") is not None:
            durations.append(call["duration_seconds"])

        analysis = call.get(Tables.CALL_ANALYSES)
        if analysis:
            analyzed_calls += 1
            if analysis.get("sentiment_score") is not None:
                sentiment_scores.append(analysis["sentiment_score"])

            label = analysis.get("sentiment_label")
            if label in sentiment_counts:
                sentiment_counts[label] += 1

    negative_count = sentiment_counts["negative"]

    return {
        "total_calls": total_calls,
        "avg_sentiment": _safe_average(sentiment_scores),
        "avg_duration": _safe_average(durations, as_int=True),
        "negative_call_percent": round((negative_count / analyzed_calls) * 100, 1) if analyzed_calls > 0 else 0.0,
        "sentiment_distribution": sentiment_counts,
    }


@db_operation
def get_top_topics(
    client: Client,
    date_from: date,
    date_to: date,
    team_id: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """
    Get the most common topics in a date range.

    Counts topic occurrences across all call analyses in the period.

    Args:
        client: Supabase client
        date_from: Start date (inclusive)
        date_to: End date (inclusive)
        team_id: Optional team filter
        limit: Maximum number of topics to return (default 10)

    Returns:
        List of topics sorted by count descending, each containing:
        - name: Topic name
        - count: Number of calls with this topic
    """
    # First get call IDs in the date range
    calls_query = (
        client.table(Tables.CALLS)
        .select("id")
        .gte("started_at", date_from.isoformat())
        .lte("started_at", f"{date_to.isoformat()}T23:59:59")
    )

    if team_id:
        calls_query = calls_query.eq("team_id", team_id)

    calls_result = calls_query.execute()
    call_ids = [c["id"] for c in calls_result.data or []]

    if not call_ids:
        return []

    # Get analyses for these calls
    analyses_result = (
        client.table(Tables.CALL_ANALYSES)
        .select("id")
        .in_("call_id", call_ids)
        .execute()
    )
    analysis_ids = [a["id"] for a in analyses_result.data or []]

    if not analysis_ids:
        return []

    # Get topic counts via the junction table
    topics_result = (
        client.table(Tables.CALL_ANALYSIS_TOPICS)
        .select(f"topic_id, {Tables.TOPICS}(name)")
        .in_("call_analysis_id", analysis_ids)
        .execute()
    )

    # Count occurrences of each topic
    topic_counts: dict[str, int] = {}
    for row in topics_result.data or []:
        topic_name = row.get(Tables.TOPICS, {}).get("name")
        if topic_name:
            topic_counts[topic_name] = topic_counts.get(topic_name, 0) + 1

    # Sort by count and limit
    sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [{"name": name, "count": count} for name, count in sorted_topics]


@db_operation
def get_agent_stats(
    client: Client,
    date_from: date,
    date_to: date,
    team_id: str | None = None,
) -> list[dict]:
    """
    Get per-agent statistics for a date range.

    Aggregates call metrics grouped by agent.

    Args:
        client: Supabase client
        date_from: Start date (inclusive)
        date_to: End date (inclusive)
        team_id: Optional team filter

    Returns:
        List of agent stats sorted by call count descending, each containing:
        - agent_id: Agent's user ID
        - name: Agent's full name
        - call_count: Number of calls handled
        - avg_sentiment: Average sentiment score
    """
    # Get calls with agent info and analyses
    query = (
        client.table(Tables.CALLS)
        .select(
            f"agent_id, {Tables.USERS}(first_name, last_name), "
            f"{Tables.CALL_ANALYSES}(sentiment_score)"
        )
        .gte("started_at", date_from.isoformat())
        .lte("started_at", f"{date_to.isoformat()}T23:59:59")
    )

    if team_id:
        query = query.eq("team_id", team_id)

    result = query.execute()

    # Aggregate by agent
    agent_data: dict[str, dict] = {}

    for call in result.data or []:
        agent_id = call.get("agent_id")
        if not agent_id:
            continue

        if agent_id not in agent_data:
            user_info = call.get(Tables.USERS) or {}
            first_name = user_info.get("first_name") or ""
            last_name = user_info.get("last_name") or ""
            full_name = f"{first_name} {last_name}".strip() or "Unknown"

            agent_data[agent_id] = {
                "agent_id": agent_id,
                "name": full_name,
                "call_count": 0,
                "sentiment_scores": [],
            }

        agent_data[agent_id]["call_count"] += 1

        analysis = call.get(Tables.CALL_ANALYSES)
        if analysis and analysis.get("sentiment_score") is not None:
            agent_data[agent_id]["sentiment_scores"].append(analysis["sentiment_score"])

    # Convert to output format
    stats = []
    for agent in agent_data.values():
        stats.append({
            "agent_id": agent["agent_id"],
            "name": agent["name"],
            "call_count": agent["call_count"],
            "avg_sentiment": _safe_average(agent["sentiment_scores"]),
        })

    # Sort by call count descending
    stats.sort(key=lambda x: x["call_count"], reverse=True)

    return stats


def _safe_average(values: list, as_int: bool = False) -> float | int | None:
    """
    Calculate average of a list, returning None if empty.

    Args:
        values: List of numeric values
        as_int: If True, round result to integer

    Returns:
        Average value, or None if list is empty
    """
    if not values:
        return None

    avg = sum(values) / len(values)

    if as_int:
        return round(avg)

    return round(avg, 3)
