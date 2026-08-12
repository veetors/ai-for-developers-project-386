"""Booking creation + slot conflict (409)."""

from __future__ import annotations

from datetime import datetime, timedelta


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value)


def test_first_booking_returns_confirmation_and_end_plus_30(
    client, make_event_type, frozen_clock, fixed_now
):
    et = make_event_type(name="BookingConfirm")
    today = fixed_now.date().isoformat()
    slots = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    target = next(s for s in slots if s["status"] == "free")
    start = _parse(target["start_at"])

    response = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start.isoformat(),
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] >= 1
    assert body["guest_name"] == "Ann"
    assert body["guest_email"] == "ann@example.com"
    assert body["event_type"]["id"] == et["id"]
    expected_end = start + timedelta(minutes=30)
    assert _parse(body["end_at"]) == expected_end
    assert _parse(body["start_at"]) == start
    assert _parse(body["created_at"]) == fixed_now


def test_double_booking_returns_409(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Conflict")
    today = fixed_now.date().isoformat()
    slots = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    target = next(s for s in slots if s["status"] == "free")
    start_iso = target["start_at"]

    first = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start_iso,
        },
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/event-types/{et['id']}/bookings",
        json={
            "guest_name": "Bob",
            "guest_email": "bob@example.com",
            "start_at": start_iso,
        },
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "slot_taken"


def test_independent_event_types_same_start_still_409(
    client, make_event_type, frozen_clock, fixed_now
):
    et_a = make_event_type(name="Type A")
    et_b = make_event_type(name="Type B")
    today = fixed_now.date().isoformat()
    slots_a = client.get(f"/api/event-types/{et_a['id']}/slots?date={today}").json()
    target = next(s for s in slots_a if s["status"] == "free")
    start_iso = target["start_at"]

    first = client.post(
        f"/api/event-types/{et_a['id']}/bookings",
        json={
            "guest_name": "Ann",
            "guest_email": "ann@example.com",
            "start_at": start_iso,
        },
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/event-types/{et_b['id']}/bookings",
        json={
            "guest_name": "Bob",
            "guest_email": "bob@example.com",
            "start_at": start_iso,
        },
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "slot_taken"
