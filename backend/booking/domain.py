"""Domain models — immutable dataclasses, persisted by repositories."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True)
class Owner:
    """Single preset calendar owner; id always equals 1 in v1."""

    id: int
    name: str
    timezone: str


@dataclass(frozen=True)
class EventType:
    """Template a guest books against."""

    id: int
    owner_id: int
    name: str
    description: str
    duration_minutes: int


@dataclass(frozen=True)
class Booking:
    """A concrete reservation of an event_type at a specific start_at."""

    id: int
    event_type_id: int
    event_type_name: str  # snapshot of the event type's name at booking time
    guest_name: str
    guest_email: str
    start_at: datetime  # tz-aware UTC
    end_at: datetime  # tz-aware UTC = start_at + duration
    created_at: datetime  # tz-aware UTC, set by server


@dataclass(frozen=True)
class Slot:
    """Computed; not persisted."""

    start_at: datetime  # tz-aware UTC
    end_at: datetime  # tz-aware UTC
    status: Literal["free", "busy"]
