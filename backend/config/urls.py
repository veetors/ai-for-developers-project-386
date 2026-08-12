"""URL wiring: single NinjaAPI, two routers (public + owner), global error handlers."""

from __future__ import annotations

from django.http import JsonResponse
from django.urls import path
from ninja import NinjaAPI
from ninja.errors import ValidationError as NinjaValidationError

from booking.api.owner.urls import router as owner_router
from booking.api.public.urls import router as public_router
from booking.errors import (
    STATUS_BY_CODE,
    AppError,
)
from booking.errors import (
    FieldError as AppFieldError,
)

api = NinjaAPI(
    title="Booking Service API",
    version="1.0.0",
    description="API for 'Запись на звонок' v1 (in-memory).",
)


@api.exception_handler(AppError)
def _handle_app_error(request, exc: AppError):
    payload = {
        "error": {
            "code": exc.code.value,
            "message": exc.message,
            "details": [d.model_dump() for d in (exc.details or [])],
        },
    }
    return api.create_response(
        request,
        payload,
        status=STATUS_BY_CODE[exc.code],
    )


@api.exception_handler(NinjaValidationError)
def _handle_ninja_validation(request, exc: NinjaValidationError):
    details: list[dict] = []
    for err in exc.errors:
        loc_raw = err.get("loc", ())
        # loc structure: [<source>, <param-name>, <field-path...>]
        # We want the field path inside the model — strip the first two segments.
        path_parts = [str(part) for part in loc_raw[2:]]
        field = ".".join(path_parts) or (str(loc_raw[0]) if loc_raw else "<root>")
        msg = err.get("msg", "Invalid value.")
        details.append(AppFieldError(field=field, messages=[msg]).model_dump())
    payload = {
        "error": {
            "code": "validation_failed",
            "message": "Request validation failed.",
            "details": details,
        },
    }
    return api.create_response(request, payload, status=422)


api.add_router("/api/event-types", public_router, tags=["public"])
api.add_router("/api/owner", owner_router, tags=["owner"])


def healthz(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("healthz", healthz),
    path("", api.urls),
]
