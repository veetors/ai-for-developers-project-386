"""In-memory implementations sharing a single threading.Lock."""

from __future__ import annotations

import threading
from datetime import datetime

from booking.domain import Booking, EventType, Owner


class InMemoryOwnerRepo:
    """Holds the single preset Owner; immutable."""

    def __init__(self, owner: Owner) -> None:
        self._owner = owner

    @property
    def owner(self) -> Owner:
        return self._owner

    @owner.setter
    def owner(self, value: Owner) -> None:
        self._owner = value

    def get_default(self) -> Owner:
        return self._owner


class InMemoryEventTypeRepo:
    """CRUD with auto-incrementing ids; mutating ops take the shared lock."""

    def __init__(self, lock: threading.Lock) -> None:
        self._lock = lock
        self._by_id: dict[int, EventType] = {}
        self._next_id: int = 1

    def list(self) -> list[EventType]:
        return sorted(self._by_id.values(), key=lambda et: et.id)

    def get(self, id: int) -> EventType | None:
        return self._by_id.get(id)

    def add(self, event_type: EventType) -> EventType:
        with self._lock:
            new = EventType(
                id=self._next_id,
                owner_id=event_type.owner_id,
                name=event_type.name,
                description=event_type.description,
                duration_minutes=event_type.duration_minutes,
            )
            self._by_id[new.id] = new
            self._next_id += 1
            return new

    def update(self, event_type: EventType) -> EventType | None:
        with self._lock:
            existing = self._by_id.get(event_type.id)
            if existing is None:
                return None
            self._by_id[event_type.id] = event_type
            return event_type

    def delete(self, id: int) -> bool:
        with self._lock:
            return self._by_id.pop(id, None) is not None

    def clear(self) -> None:
        with self._lock:
            self._by_id.clear()
            self._next_id = 1


class InMemoryBookingRepo:
    """Reservation storage with an atomic try_reserve() for slot conflicts."""

    def __init__(self, lock: threading.Lock) -> None:
        self._lock = lock
        self._by_id: dict[int, Booking] = {}
        self._next_id: int = 1

    def list_upcoming(self, now: datetime) -> list[Booking]:
        return sorted(
            (b for b in self._by_id.values() if b.start_at >= now),
            key=lambda b: b.start_at,
        )

    def get(self, id: int) -> Booking | None:
        return self._by_id.get(id)

    def has_conflict(self, start_at: datetime) -> bool:
        with self._lock:
            return any(b.start_at == start_at for b in self._by_id.values())

    def add(self, booking: Booking) -> Booking:
        with self._lock:
            new = Booking(
                id=self._next_id,
                event_type_id=booking.event_type_id,
                event_type_name=booking.event_type_name,
                guest_name=booking.guest_name,
                guest_email=booking.guest_email,
                start_at=booking.start_at,
                end_at=booking.end_at,
                created_at=booking.created_at,
            )
            self._by_id[new.id] = new
            self._next_id += 1
            return new

    def reserve(self, booking: Booking) -> Booking | None:
        """Atomically check + insert; returns saved Booking or None on conflict.

        Equivalent to a future DB-level SELECT ... FOR UPDATE + UniqueConstraint.
        The incoming ``booking.id`` is ignored and replaced with the next id.
        """

        with self._lock:
            if any(b.start_at == booking.start_at for b in self._by_id.values()):
                return None
            saved = Booking(
                id=self._next_id,
                event_type_id=booking.event_type_id,
                event_type_name=booking.event_type_name,
                guest_name=booking.guest_name,
                guest_email=booking.guest_email,
                start_at=booking.start_at,
                end_at=booking.end_at,
                created_at=booking.created_at,
            )
            self._by_id[saved.id] = saved
            self._next_id += 1
            return saved

    def next_id(self) -> int:
        return self._next_id

    def advance_id(self) -> int:
        with self._lock:
            current = self._next_id
            self._next_id += 1
            return current

    def clear(self) -> None:
        with self._lock:
            self._by_id.clear()
            self._next_id = 1
