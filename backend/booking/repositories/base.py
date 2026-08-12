"""Repository interfaces (Protocols) for the in-memory storage layer."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from booking.domain import Booking, EventType, Owner


class OwnerRepo(Protocol):
    def get_default(self) -> Owner: ...


class EventTypeRepo(Protocol):
    def list(self) -> list[EventType]: ...

    def get(self, id: int) -> EventType | None: ...

    def add(self, event_type: EventType) -> EventType: ...

    def update(self, event_type: EventType) -> EventType | None: ...

    def delete(self, id: int) -> bool: ...


class BookingRepo(Protocol):
    def list_upcoming(self, now: datetime) -> list[Booking]: ...

    def get(self, id: int) -> Booking | None: ...

    def has_conflict(self, start_at: datetime) -> bool: ...

    def add(self, booking: Booking) -> Booking: ...
