"""EventType service — CRUD plus the v1 duration==30 invariant."""

from __future__ import annotations

from booking.domain import EventType, Owner
from booking.errors import AppError, ErrorCode
from booking.repositories.base import EventTypeRepo

ALLOWED_DURATION_MINUTES: int = 30


class EventTypeIn:
    """Plain input value object (decoupled from pydantic API layer)."""

    def __init__(self, name: str, description: str, duration_minutes: int) -> None:
        self.name = name
        self.description = description
        self.duration_minutes = duration_minutes


class EventTypeService:
    def __init__(self, repo: EventTypeRepo, owner: Owner) -> None:
        self._repo = repo
        self._owner = owner

    def list_all(self) -> list[EventType]:
        return self._repo.list()

    def get(self, id: int) -> EventType:
        et = self._repo.get(id)
        if et is None:
            raise AppError(ErrorCode.EVENT_TYPE_NOT_FOUND, "Тип события не найден.")
        return et

    def create(self, data: EventTypeIn) -> EventType:
        self._assert_duration(data.duration_minutes)
        draft = EventType(
            id=0,
            owner_id=self._owner.id,
            name=data.name,
            description=data.description,
            duration_minutes=data.duration_minutes,
        )
        return self._repo.add(draft)

    def update(self, id: int, data: EventTypeIn) -> EventType:
        existing = self.get(id)  # raises event_type_not_found if missing
        self._assert_duration(data.duration_minutes)
        new = EventType(
            id=existing.id,
            owner_id=existing.owner_id,
            name=data.name,
            description=data.description,
            duration_minutes=data.duration_minutes,
        )
        updated = self._repo.update(new)
        if updated is None:
            raise AppError(ErrorCode.EVENT_TYPE_NOT_FOUND, "Тип события не найден.")
        return updated

    def delete(self, id: int) -> None:
        if not self._repo.delete(id):
            raise AppError(ErrorCode.EVENT_TYPE_NOT_FOUND, "Тип события не найден.")

    def _assert_duration(self, duration_minutes: int) -> None:
        if duration_minutes != ALLOWED_DURATION_MINUTES:
            raise AppError(
                ErrorCode.INVALID_DURATION,
                "Длительность должна быть 30 минут.",
            )
