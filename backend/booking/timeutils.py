"""Time helpers: MSK<->UTC, working-hours window, 30-min slot grid."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

MSK = ZoneInfo("Europe/Moscow")

WORK_START: time = time(6, 0)
WORK_END: time = time(22, 0)

GRID_MINUTES: int = 30
SLOTS_PER_DAY: int = 32  # 06:00..21:30 inclusive start, end=22:00


def now_utc() -> datetime:
    """Server-wide monotonic clock used as default by services."""

    return datetime.now(tz=UTC)


def today_msk(now: datetime) -> date:
    """Return today's date in Europe/Moscow for a tz-aware UTC moment."""

    return now.astimezone(MSK).date()


def window_dates_msk(now: datetime) -> tuple[date, date]:
    """Return (today, today+13) — exclusive 14-day window in Europe/Moscow."""

    start = today_msk(now)
    end = start + timedelta(days=13)
    return start, end


def combine_msk_to_utc(d: date, t: time) -> datetime:
    """Compose date+time in MSK and convert to tz-aware UTC."""

    return datetime.combine(d, t, tzinfo=MSK).astimezone(UTC)


def parse_query_date(value: str) -> date:
    """Strict YYYY-MM-DD parser used by slot queries."""

    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid date '{value}', expected YYYY-MM-DD") from exc


def duration_minutes_for(_event_type_duration_minutes: int) -> timedelta:
    """Return the duration of the event in minutes as a timedelta."""

    return timedelta(minutes=_event_type_duration_minutes)


def is_within_work_hours_msk(start_at_utc: datetime) -> bool:
    """True iff the local MSK start time is within [WORK_START, WORK_END)."""

    if start_at_utc.tzinfo is None:
        raise ValueError("start_at must be tz-aware UTC")
    local = start_at_utc.astimezone(MSK)
    return WORK_START <= local.time() < WORK_END


def grid_for_date_msk(d: date) -> list[tuple[datetime, datetime]]:
    """Yield 32 (start_utc, end_utc) pairs for the working day 06:00..22:00 MSK."""

    out: list[tuple[datetime, datetime]] = []
    for step in range(SLOTS_PER_DAY):
        start_local = time(
            hour=WORK_START.hour + (step * GRID_MINUTES) // 60,
            minute=(step * GRID_MINUTES) % 60,
        )
        end_local = datetime.combine(d, start_local, tzinfo=MSK) + duration_minutes_for(
            GRID_MINUTES
        )
        start_utc = datetime.combine(d, start_local, tzinfo=MSK).astimezone(UTC)
        end_utc = end_local.astimezone(UTC)
        out.append((start_utc, end_utc))
    return out
