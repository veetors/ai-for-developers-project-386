"""Service dependency factories used by django-ninja routers.

We always look up ``now_utc`` through the module attribute (not a
re-bound local name) so tests can monkeypatch ``booking.timeutils.now_utc``
and immediately get a service that uses the fixed clock.
"""

from __future__ import annotations

from booking import timeutils
from booking.app_registry import app_registry
from booking.services.bookings import BookingService
from booking.services.event_types import EventTypeService
from booking.services.slots import SlotService


def get_event_type_service() -> EventTypeService:
    return EventTypeService(repo=app_registry.event_types, owner=app_registry.owner)


def get_slot_service() -> SlotService:
    return SlotService(
        event_types=app_registry.event_types,
        bookings=app_registry.bookings,
        clock=timeutils.now_utc,
    )


def get_booking_service() -> BookingService:
    return BookingService(
        bookings=app_registry.bookings,
        event_type_service=get_event_type_service(),
        clock=timeutils.now_utc,
    )
