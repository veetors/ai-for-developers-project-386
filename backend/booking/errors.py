"""Error model: single ErrorCode enum, ErrorCode->HTTP status map, AppError."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ErrorCode(str, Enum):
    """Stable string identifiers for the frontend ErrorBody."""

    VALIDATION_FAILED = "validation_failed"
    SLOT_OUTSIDE_WINDOW = "slot_outside_window"
    SLOT_OUTSIDE_HOURS = "slot_outside_hours"
    SLOT_IN_PAST = "slot_in_past"
    SLOT_TAKEN = "slot_taken"
    EVENT_TYPE_NOT_FOUND = "event_type_not_found"
    BOOKING_NOT_FOUND = "booking_not_found"
    INVALID_DURATION = "invalid_duration"
    INTERNAL_ERROR = "internal_error"


STATUS_BY_CODE: dict[ErrorCode, int] = {
    ErrorCode.EVENT_TYPE_NOT_FOUND: 404,
    ErrorCode.BOOKING_NOT_FOUND: 404,
    ErrorCode.SLOT_TAKEN: 409,
    ErrorCode.VALIDATION_FAILED: 422,
    ErrorCode.SLOT_OUTSIDE_WINDOW: 422,
    ErrorCode.SLOT_OUTSIDE_HOURS: 422,
    ErrorCode.SLOT_IN_PAST: 422,
    ErrorCode.INVALID_DURATION: 422,
    ErrorCode.INTERNAL_ERROR: 500,
}


class FieldError(BaseModel):
    """Single validation field-level error."""

    field: str
    messages: list[str] = Field(default_factory=list)


class AppError(Exception):
    """Domain error raised by services, mapped to HTTP by global handler."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: list[FieldError] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
