"""Unit tests for call database helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from database.calls import create_call
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
