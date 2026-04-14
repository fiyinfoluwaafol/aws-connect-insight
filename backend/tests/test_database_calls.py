"""Unit tests for call database helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from database.calls import create_call, search_calls
from database.constants import Tables


def test_create_call_includes_transcript_when_provided() -> None:
    """create_call should include transcript in the inserted payload when present."""
    client = MagicMock()
    transcript = [{"speaker": "Customer", "text": "Hello"}]
    client.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "call-123", "transcript": transcript}]
    )

    result = create_call(
        client,
        agent_id="agent-1",
        team_id="team-1",
        recording_url="https://example.com/recordings/test.mp3",
        duration_seconds=300,
        started_at="2026-04-02T12:00:00",
        transcript=transcript,
    )

    client.table.assert_called_once_with(Tables.CALLS)
    client.table.return_value.insert.assert_called_once_with(
        {
            "agent_id": "agent-1",
            "team_id": "team-1",
            "recording_url": "https://example.com/recordings/test.mp3",
            "duration_seconds": 300,
            "started_at": "2026-04-02T12:00:00",
            "transcript": transcript,
        }
    )
    assert result["id"] == "call-123"


def test_search_calls_total_uses_distinct_count_query() -> None:
    """total must match the count query, not a join-inflated row count from topic embeds."""
    client = MagicMock()

    def make_chain(execute_result):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.lte.return_value = chain
        chain.lt.return_value = chain
        chain.ilike.return_value = chain
        chain.contains.return_value = chain
        chain.order.return_value = chain
        chain.range.return_value = chain
        chain.execute.return_value = execute_result
        return chain

    count_result = SimpleNamespace(data=[], count=3)
    data_result = SimpleNamespace(
        data=[{"id": "call-1", "call_analyses": []}],
        count=99,
    )
    chains = iter([make_chain(count_result), make_chain(data_result)])
    client.table.side_effect = lambda _name: next(chains)

    result = search_calls(client, team_id="team-1", page=1, per_page=20)

    assert result["total"] == 3
    assert len(result["calls"]) == 1
    assert client.table.call_count == 2
