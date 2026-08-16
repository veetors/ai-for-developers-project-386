"""Booking service — applies business rules and atomically reserves slots."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from booking.domain import Booking
from booking.errors import AppError, ErrorCode
from booking.repositories.base import BookingRepo
from booking.services.event_types import EventTypeService
from booking.timeutils import (
    duration_minutes_for,
    is_within_work_hours_msk,
    window_dates_msk,
)


@dataclass(frozen=True)
class BookingRequest:
    guest_name: str
    guest_email: str
    start_at: datetime  # tz-aware UTC


@dataclass(frozen=True)
class AdminBookingRow:
    """Joined row for the admin list — kept flat to match AdminBookingOut."""

    booking: Booking
    event_type_name: str


class BookingService:
    def __init__(
        self,
        bookings: BookingRepo,
        event_type_service: EventTypeService,
        clock: Callable[[], datetime],
    ) -> None:
        self._bookings = bookings
        self._event_type_service = event_type_service
        self._clock = clock

    def create(self, event_type_id: int, request: BookingRequest) -> Booking:
        event_type = self._event_type_service.get(event_type_id)

        start_at = request.start_at
        if start_at.tzinfo is None:
            raise AppError(
                ErrorCode.VALIDATION_FAILED,
                "start_at должен содержать UTC-смещение (ISO 8601 с таймзоной).",
            )

        now = self._clock()
        self._assert_future(start_at, now)
        self._assert_in_window(start_at, now)
        self._assert_in_work_hours(start_at)

        duration = duration_minutes_for(event_type.duration_minutes)
        end_at = start_at + duration
        # Reserve atomically and let the repo assign the id (auto-increment).
        # We use a sentinel id=0; the repo's reserve() ignores it and assigns the next one.
        draft = Booking(
            id=0,
            event_type_id=event_type.id,
            event_type_name=event_type.name,
            guest_name=request.guest_name,
            guest_email=request.guest_email,
            start_at=start_at,
            end_at=end_at,
            created_at=now,
        )
        booking = self._bookings.reserve(draft)
        if booking is None:
            raise AppError(
                ErrorCode.SLOT_TAKEN,
                "Слот только что заняли. Выберите другое время.",
            )
        return booking

    def list_upcoming_admin(self) -> list[AdminBookingRow]:
        return [
            AdminBookingRow(booking=b, event_type_name=b.event_type_name)
            for b in self._bookings.list_upcoming(self._clock())
        ]

    def _assert_future(self, start_at: datetime, now: datetime) -> None:
        if start_at < now:
            raise AppError(
                ErrorCode.SLOT_IN_PAST,
                "Это время уже прошло.",
            )

    def _assert_in_window(self, start_at: datetime, now: datetime) -> None:
        local_date = start_at.astimezone(ZoneInfo("Europe/Moscow")).date()
        win_start, win_end = window_dates_msk(now)
        if local_date < win_start or local_date > win_end:
            raise AppError(
                ErrorCode.SLOT_OUTSIDE_WINDOW,
                "Дата вне доступного окна (14 дней).",
            )

    def _assert_in_work_hours(self, start_at: datetime) -> None:
        if not is_within_work_hours_msk(start_at):
            raise AppError(
                ErrorCode.SLOT_OUTSIDE_HOURS,
                "Время вне рабочего диапазона 06:00–22:00 МСК.",
            )
