"""Slot service — produces a day grid of 32 30-min slots with free/busy flags."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from booking.domain import Slot
from booking.errors import AppError, ErrorCode
from booking.repositories.base import BookingRepo, EventTypeRepo
from booking.timeutils import grid_for_date_msk, parse_query_date, window_dates_msk


class SlotService:
    """Builds the 30-minute slot grid for a single day in Europe/Moscow.

    The grid itself spans 06:00..22:00 MSK in 30-min steps (32 slots). All slots
    are returned; past slots and slots occupied by an existing booking are
    marked ``busy`` rather than omitted, per OpenAPI summary.
    """

    def __init__(
        self,
        event_types: EventTypeRepo,
        bookings: BookingRepo,
        clock: Callable[[], datetime],
    ) -> None:
        self._event_types = event_types
        self._bookings = bookings
        self._clock = clock

    def grid_for_day(self, event_type_id: int, date_ymd: str) -> list[Slot]:
        event_type = self._event_types.get(event_type_id)
        if event_type is None:
            raise AppError(
                ErrorCode.EVENT_TYPE_NOT_FOUND,
                "Тип события не найден.",
            )

        try:
            target = parse_query_date(date_ymd)
        except ValueError as exc:
            raise AppError(
                ErrorCode.VALIDATION_FAILED,
                f"Некорректная дата '{date_ymd}', ожидается YYYY-MM-DD.",
            ) from exc

        now = self._clock()
        win_start, win_end = window_dates_msk(now)
        if target < win_start or target > win_end:
            raise AppError(
                ErrorCode.SLOT_OUTSIDE_WINDOW,
                "Дата вне доступного окна (14 дней).",
            )

        slots: list[Slot] = []
        for start_utc, end_utc in grid_for_date_msk(target):
            in_past = start_utc < now
            taken = self._bookings.has_conflict(start_utc)
            slots.append(
                Slot(
                    start_at=start_utc,
                    end_at=end_utc,
                    status="busy" if in_past or taken else "free",
                )
            )
        return slots
