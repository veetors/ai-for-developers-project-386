"""Slot grid: 32 30-min slots, busy/past/taken flags, window check."""

from __future__ import annotations

from datetime import datetime, timedelta

from booking.app_registry import app_registry
from booking.domain import Booking


def test_grid_today_full(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Today")
    today = fixed_now.date().isoformat()
    response = client.get(f"/api/event-types/{et['id']}/slots?date={today}")
    assert response.status_code == 200
    slots = response.json()
    assert len(slots) == 32  # 06:00..21:30 MSK


def test_slot_step_and_duration(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Duration")
    today = fixed_now.date().isoformat()
    slots = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    base = datetime.fromisoformat(slots[0]["start_at"])
    for idx, slot in enumerate(slots):
        start = datetime.fromisoformat(slot["start_at"])
        end = datetime.fromisoformat(slot["end_at"])
        assert end - start == timedelta(minutes=30)
        diff_minutes = int((start - base).total_seconds() // 60)
        assert diff_minutes == idx * 30


def test_past_slots_are_busy(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Past")
    today = fixed_now.date().isoformat()
    slots = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    for slot in slots:
        end = datetime.fromisoformat(slot["end_at"])
        if end <= fixed_now:
            assert slot["status"] == "busy"


def test_taken_slot_marked_busy(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Taken")
    today = fixed_now.date().isoformat()
    slots = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    free_slots = [s for s in slots if s["status"] == "free"]
    assert free_slots, "expected at least one free slot"
    target = free_slots[len(free_slots) // 2]

    target_dt = datetime.fromisoformat(target["start_at"])
    booking_id = app_registry.bookings.advance_id()
    booking = Booking(
        id=booking_id,
        event_type_id=et["id"],
        event_type_name=et["name"],
        guest_name="Ann",
        guest_email="ann@example.com",
        start_at=target_dt,
        end_at=target_dt + timedelta(minutes=30),
        created_at=fixed_now,
    )
    assert app_registry.bookings.reserve(booking) is not None

    refreshed = client.get(f"/api/event-types/{et['id']}/slots?date={today}").json()
    matches = [s for s in refreshed if s["start_at"] == target["start_at"]]
    assert matches and matches[0]["status"] == "busy"


def test_outside_window_rejected(client, make_event_type, frozen_clock, fixed_now):
    et = make_event_type(name="Window")
    far_future = (fixed_now.date() + timedelta(days=20)).isoformat()
    response = client.get(f"/api/event-types/{et['id']}/slots?date={far_future}")
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "slot_outside_window"


def test_unknown_event_type_returns_404(client, frozen_clock, fixed_now):
    response = client.get(f"/api/event-types/9999/slots?date={fixed_now.date().isoformat()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_type_not_found"


def test_invalid_date_format_rejected(client, make_event_type):
    et = make_event_type(name="Bad date")
    response = client.get(f"/api/event-types/{et['id']}/slots?date=01.06.2099")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
