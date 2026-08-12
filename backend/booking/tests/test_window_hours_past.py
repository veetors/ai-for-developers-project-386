"""Negative scenarios: window/hours/past + email/name client-side validation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

MSK = ZoneInfo("Europe/Moscow")


def _future_msk(fixed_now: datetime, hour: int, minute: int = 0) -> datetime:
    today = fixed_now.date()
    local = datetime(today.year, today.month, today.day, hour, minute, tzinfo=MSK)
    return local.astimezone(UTC)


def test_start_at_in_past_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Past booking")
    start = fixed_now.astimezone(UTC) - timedelta(minutes=10)
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "slot_in_past"


def test_date_outside_window_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Window booking")
    # 14 days ahead — outside the [today..today+13] window
    target_date = fixed_now.date() + timedelta(days=14)
    local = datetime(target_date.year, target_date.month, target_date.day, 10, 0, tzinfo=MSK)
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": local.astimezone(UTC).isoformat(),
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "slot_outside_window"


def test_time_outside_work_hours_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Out of hours")
    start = _future_msk(fixed_now, hour=23, minute=30)
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "slot_outside_hours"


def test_time_at_work_hours_boundary_accepted(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Boundary")
    start = _future_msk(fixed_now, hour=21, minute=30)  # 21:30 MSK, last valid slot
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 200, response.text


def test_unknown_event_type_returns_404_when_booking(client, frozen_clock, fixed_now):
    start = _future_msk(fixed_now, hour=10)
    response = client.post(
        "/api/event-types/9999/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_type_not_found"


def test_invalid_email_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Bad email")
    start = _future_msk(fixed_now, hour=10)
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "not-an-email",
            "start_at": start.isoformat(),
        },
    )
    print("DEBUG response:", response.status_code, response.text)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_failed"
    fields = [d["field"] for d in (body["error"]["details"] or [])]
    assert "guest_email" in fields


def test_empty_name_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Bad name")
    start = _future_msk(fixed_now, hour=11)
    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_failed"
    fields = [d["field"] for d in (body["error"]["details"] or [])]
    assert "guest_name" in fields
