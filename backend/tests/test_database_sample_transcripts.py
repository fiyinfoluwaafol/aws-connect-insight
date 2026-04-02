"""Unit tests for sample transcript database helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from database.constants import Tables
from database.exceptions import NotFoundError
from database.sample_transcripts import get_random_sample_transcript


def test_get_random_sample_transcript_returns_random_row() -> None:
    """Helper should return one random transcript from the available sample pool."""
    client = MagicMock()
    query = client.table.return_value.select.return_value
    query.execute.return_value = SimpleNamespace(
        data=[
            {"id": "sample-1", "transcript": [{"speaker": "Customer", "text": "Help"}]},
        ]
    )

    with patch(
        "database.sample_transcripts.random.choice",
        return_value=query.execute.return_value.data[0],
    ):
        result = get_random_sample_transcript(client)

    client.table.assert_called_once_with(Tables.SAMPLE_TRANSCRIPTS)
    client.table.return_value.select.assert_called_once_with("*")
    assert result["id"] == "sample-1"


def test_get_random_sample_transcript_uses_random_choice() -> None:
    """Helper should defer the actual row selection to random.choice."""
    client = MagicMock()
    query = client.table.return_value.select.return_value
    query.execute.return_value = SimpleNamespace(
        data=[
            {"id": "sample-1"},
            {"id": "sample-2"},
        ]
    )

    with patch(
        "database.sample_transcripts.random.choice",
        return_value=query.execute.return_value.data[1],
    ) as choice_mock:
        result = get_random_sample_transcript(client)

    choice_mock.assert_called_once_with(query.execute.return_value.data)
    assert result["id"] == "sample-2"


def test_get_random_sample_transcript_raises_when_empty() -> None:
    """Helper should raise NotFoundError when no transcript rows match."""
    client = MagicMock()
    query = client.table.return_value.select.return_value
    query.execute.return_value = SimpleNamespace(data=[])

    with pytest.raises(NotFoundError, match="No sample transcripts found"):
        get_random_sample_transcript(client)
