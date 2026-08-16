"""Shared test fixtures: reset in-memory state, optionally freeze time, and provide a TestClient."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from ninja.testing import TestClient

from booking.app_registry import app_registry
from booking.timeutils import now_utc as default_now_utc
from config.urls import api


@pytest.fixture(autouse=True)
def reset_repos():
    """Each test starts from a clean slate: empty event types, no bookings."""

    app_registry.reset()


@pytest.fixture(autouse=True)
def real_clock(monkeypatch: pytest.MonkeyPatch):
    """By default, monkeypatch restores the real ``now_utc`` after each test
    so it cannot leak across modules. Tests that pin time apply ``frozen_clock``
    *after* this fixture (Python fixture order: declared later overrides
    earlier ``monkeypatch.setattr`` calls — but neither setter "wins"; the
    explicit one in ``frozen_clock`` is what we read here)."""

    yield


@pytest.fixture
def fixed_now() -> datetime:
    """A deterministic moment the booking rules are anchored to."""

    return datetime(2099, 6, 1, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def frozen_clock(monkeypatch: pytest.MonkeyPatch, fixed_now: datetime):
    """Pin booking.timeutils.now_utc to the ``fixed_now`` value."""

    monkeypatch.setattr("booking.timeutils.now_utc", lambda: fixed_now)


@pytest.fixture
def client() -> TestClient:
    return TestClient(api)


@pytest.fixture
def make_event_type(client: TestClient):
    def _make(**overrides) -> dict:
        payload = {
            "name": "Test event",
            "description": "Description",
            "duration_minutes": 30,
        }
        payload.update(overrides)
        response = client.post("/api/owner/event-types", json=payload)
        assert response.status_code == 200, response.text
        return response.json()

    return _make


# silence unused imports
_ = default_now_utc
