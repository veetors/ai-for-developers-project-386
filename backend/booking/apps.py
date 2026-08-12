"""Django AppConfig — bootstraps the in-memory AppRegistry on app start."""

from __future__ import annotations

from django.apps import AppConfig

from booking.app_registry import app_registry


class BookingConfig(AppConfig):
    name = "booking"
    verbose_name = "Booking"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        app_registry.bootstrap()
