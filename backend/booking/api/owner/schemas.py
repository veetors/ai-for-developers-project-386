"""Owner (admin) pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ErrorCodeEnum(str, Enum):
    validation_failed = "validation_failed"
    slot_outside_window = "slot_outside_window"
    slot_outside_hours = "slot_outside_hours"
    slot_in_past = "slot_in_past"
    slot_taken = "slot_taken"
    event_type_not_found = "event_type_not_found"
    booking_not_found = "booking_not_found"
    invalid_duration = "invalid_duration"
    internal_error = "internal_error"


class FieldErrorOut(BaseModel):
    field: str
    messages: list[str]


class ErrorBodyOut(BaseModel):
    code: ErrorCodeEnum
    message: str
    details: list[FieldErrorOut] | None = None


class EventTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str
    duration_minutes: int


class EventTypeOut(BaseModel):
    id: int
    name: str
    description: str
    duration_minutes: int


class AdminBookingOut(BaseModel):
    id: int
    event_type_id: int
    event_type_name: str
    guest_name: str
    guest_email: str
    start_at: datetime
    end_at: datetime
    created_at: datetime
