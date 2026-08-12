"""Singleton registry of repositories — built once in AppConfig.ready()."""

from __future__ import annotations

import threading

from booking.domain import Owner
from booking.repositories.memory import (
    InMemoryBookingRepo,
    InMemoryEventTypeRepo,
    InMemoryOwnerRepo,
)
from booking.seed import bootstrap_owner


class AppRegistry:
    """Holds the single lock and the three in-memory repositories."""

    def __init__(self) -> None:
        self._lock: threading.Lock = threading.Lock()
        self._owner_repo: InMemoryOwnerRepo | None = None
        self.event_types: InMemoryEventTypeRepo = InMemoryEventTypeRepo(self._lock)
        self.bookings: InMemoryBookingRepo = InMemoryBookingRepo(self._lock)

    def bootstrap(self) -> None:
        if self._owner_repo is not None:
            return
        self._owner_repo = InMemoryOwnerRepo(bootstrap_owner())

    @property
    def owner(self) -> Owner:
        if self._owner_repo is None:
            raise RuntimeError("AppRegistry not bootstrapped yet")
        return self._owner_repo.get_default()

    def reset(self) -> None:
        """Wipe mutable state. Used by test fixtures to start each test clean."""

        self.event_types.clear()
        self.bookings.clear()
        if self._owner_repo is not None:
            self._owner_repo.owner = bootstrap_owner()


app_registry = AppRegistry()
