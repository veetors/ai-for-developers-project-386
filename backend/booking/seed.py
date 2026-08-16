"""Initial data seed: a single preset Owner is created at startup."""

from __future__ import annotations

from booking.domain import Owner

OWNER_DEFAULT_NAME = "Host"


def bootstrap_owner() -> Owner:
    """Build the single preset owner used by all event types."""

    return Owner(id=1, name=OWNER_DEFAULT_NAME, timezone="Europe/Moscow")
