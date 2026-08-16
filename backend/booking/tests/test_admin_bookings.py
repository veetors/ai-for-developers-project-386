"""/api/owner/bookings: upcoming only, sorted, survives deletion of event type."""

from __future__ import annotations

from datetime import datetime, timedelta

from booking.app_registry import app_registry
from booking.domain import Booking


def _insert_booking(
    event_type_id: int,
    start_at,
    fixed_now,
    guest_name: str = "Ann",
    guest_email: str = "ann@example.com",
) -> None:
    end_at = start_at + timedelta(minutes=30)
    et = app_registry.event_types.get(event_type_id)
    assert et is not None
    booking_draft = Booking(
        id=0,
        event_type_id=event_type_id,
        event_type_name=et.name,
        guest_name=guest_name,
        guest_email=guest_email,
        start_at=start_at,
        end_at=end_at,
        created_at=fixed_now,
    )
    assert app_registry.bookings.reserve(booking_draft) is not None


def test_admin_list_filters_past_and_sorts_asc(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Admin list")

    future_a = fixed_now + timedelta(days=2, hours=2)
    future_b = fixed_now + timedelta(days=1, hours=1)
    past = fixed_now - timedelta(days=1)

    _insert_booking(et["id"], future_a, fixed_now)
    _insert_booking(et["id"], future_b, fixed_now)
    _insert_booking(et["id"], past, fixed_now)

    response = client.get("/api/owner/bookings")
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 2
    starts = [datetime.fromisoformat(r["start_at"]) for r in rows]
    assert starts == sorted(starts)
    assert starts[0] == future_b
    assert starts[1] == future_a


def test_admin_list_shows_event_type_name(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Named event")
    start = fixed_now + timedelta(days=1, hours=3)
    _insert_booking(et["id"], start, fixed_now)
    rows = client.get("/api/owner/bookings").json()
    assert len(rows) == 1
    assert rows[0]["event_type_id"] == et["id"]
    assert rows[0]["event_type_name"] == "Named event"
    assert rows[0]["guest_name"] == "Ann"


def test_admin_list_after_event_type_delete_keeps_rows(
    client, make_event_type, frozen_clock, fixed_now
):
    et = make_event_type(name="Soon gone")
    start = fixed_now + timedelta(days=1, hours=4)
    _insert_booking(et["id"], start, fixed_now)

    assert client.delete(f"/api/owner/event-types/{et['id']}").status_code == 204

    rows = client.get("/api/owner/bookings").json()
    assert len(rows) == 1
    assert rows[0]["event_type_id"] == et["id"]
    assert rows[0]["event_type_name"] == "Soon gone"


def test_admin_list_empty_by_default(client):
    response = client.get("/api/owner/bookings")
    assert response.status_code == 200
    assert response.json() == []
