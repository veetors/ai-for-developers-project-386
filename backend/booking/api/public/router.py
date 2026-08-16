"""Public (guest-facing) API router."""

from __future__ import annotations

from ninja import Router

from booking.api.deps import (
    get_booking_service,
    get_event_type_service,
    get_slot_service,
)
from booking.api.public.schemas import (
    BookingConfirmationOut,
    BookingRequestIn,
    ErrorBodyOut,
    EventTypeOut,
    SlotOut,
)
from booking.domain import EventType, Slot
from booking.services.bookings import BookingRequest, BookingService
from booking.services.event_types import EventTypeService
from booking.services.slots import SlotService

router = Router()


def _event_type_out(et: EventType) -> EventTypeOut:
    return EventTypeOut(
        id=et.id,
        name=et.name,
        description=et.description,
        duration_minutes=et.duration_minutes,
    )


def _slot_out(s: Slot) -> SlotOut:
    return SlotOut(start_at=s.start_at, end_at=s.end_at, status=s.status)


def _booking_confirmation_out(booking, event_type: EventType) -> BookingConfirmationOut:
    return BookingConfirmationOut(
        id=booking.id,
        event_type=_event_type_out(event_type),
        guest_name=booking.guest_name,
        guest_email=booking.guest_email,
        start_at=booking.start_at,
        end_at=booking.end_at,
        created_at=booking.created_at,
    )


@router.get("", response=list[EventTypeOut])
def list_event_types(request) -> list[EventTypeOut]:
    service: EventTypeService = get_event_type_service()
    return [_event_type_out(et) for et in service.list_all()]


@router.get("/{id}", response={200: EventTypeOut, 404: ErrorBodyOut})
def get_event_type(request, id: int) -> EventTypeOut:
    service: EventTypeService = get_event_type_service()
    return _event_type_out(service.get(id))


@router.get(
    "/{id}/slots",
    response={200: list[SlotOut], 404: ErrorBodyOut, 422: ErrorBodyOut},
)
def get_slots(request, id: int, date: str) -> list[SlotOut]:
    service: SlotService = get_slot_service()
    return [_slot_out(s) for s in service.grid_for_day(id, date)]


@router.post(
    "/{id}/bookings",
    response={
        200: BookingConfirmationOut,
        404: ErrorBodyOut,
        409: ErrorBodyOut,
        422: ErrorBodyOut,
    },
)
def create_booking(
    request,
    id: int,
    payload: BookingRequestIn,
) -> BookingConfirmationOut:
    service: BookingService = get_booking_service()
    req = BookingRequest(
        guest_name=payload.guest_name,
        guest_email=str(payload.guest_email),
        start_at=payload.start_at,
    )
    booking = service.create(id, req)
    event_type_service = get_event_type_service()
    event_type = event_type_service.get(booking.event_type_id)
    return _booking_confirmation_out(booking, event_type)
