"""Owner (admin) API router."""

from __future__ import annotations

from http import HTTPStatus

from ninja import Router
from ninja.responses import Status

from booking.api.deps import (
    get_booking_service,
    get_event_type_service,
)
from booking.api.owner.schemas import (
    AdminBookingOut,
    ErrorBodyOut,
    EventTypeIn,
    EventTypeOut,
)
from booking.domain import EventType
from booking.services.bookings import BookingService
from booking.services.event_types import EventTypeIn as SvcEventTypeIn
from booking.services.event_types import EventTypeService

# Ninja renders 204 via the response map (None payload). Use a sentinel below.
_NO_CONTENT = None


router = Router()


def _event_type_out(et: EventType) -> EventTypeOut:
    return EventTypeOut(
        id=et.id,
        name=et.name,
        description=et.description,
        duration_minutes=et.duration_minutes,
    )


@router.get("/event-types", response=list[EventTypeOut])
def list_event_types(request) -> list[EventTypeOut]:
    service: EventTypeService = get_event_type_service()
    return [_event_type_out(et) for et in service.list_all()]


@router.post("/event-types", response={200: EventTypeOut, 422: ErrorBodyOut})
def create_event_type(request, payload: EventTypeIn) -> EventTypeOut:
    service: EventTypeService = get_event_type_service()
    et = service.create(
        SvcEventTypeIn(
            name=payload.name,
            description=payload.description,
            duration_minutes=payload.duration_minutes,
        )
    )
    return _event_type_out(et)


@router.get("/event-types/{id}", response={200: EventTypeOut, 404: ErrorBodyOut})
def get_event_type(request, id: int) -> EventTypeOut:
    service: EventTypeService = get_event_type_service()
    return _event_type_out(service.get(id))


@router.put(
    "/event-types/{id}",
    response={200: EventTypeOut, 404: ErrorBodyOut, 422: ErrorBodyOut},
)
def update_event_type(
    request,
    id: int,
    payload: EventTypeIn,
) -> EventTypeOut:
    service: EventTypeService = get_event_type_service()
    et = service.update(
        id,
        SvcEventTypeIn(
            name=payload.name,
            description=payload.description,
            duration_minutes=payload.duration_minutes,
        ),
    )
    return _event_type_out(et)


@router.delete(
    "/event-types/{id}",
    response={HTTPStatus.NO_CONTENT.value: type(None), 404: ErrorBodyOut},
)
def delete_event_type(request, id: int):
    service: EventTypeService = get_event_type_service()
    service.delete(id)
    return Status(HTTPStatus.NO_CONTENT.value, None)


@router.get("/bookings", response=list[AdminBookingOut])
def list_bookings(request) -> list[AdminBookingOut]:
    service: BookingService = get_booking_service()
    return [
        AdminBookingOut(
            id=row.booking.id,
            event_type_id=row.booking.event_type_id,
            event_type_name=row.event_type_name,
            guest_name=row.booking.guest_name,
            guest_email=row.booking.guest_email,
            start_at=row.booking.start_at,
            end_at=row.booking.end_at,
            created_at=row.booking.created_at,
        )
        for row in service.list_upcoming_admin()
    ]


_ = _NO_CONTENT  # keep symbol referenced
