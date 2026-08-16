# Backend — «Запись на звонок» (v1, in-memory)

Django 6 + django-ninja + pydantic v2 бэкенд для SPA из `frontend/`.
Хранилище — оперативная память; после перезапуска контейнера данные сбрасываются.
Все бизнес-правила (14-дневное окно, рабочие часы 06:00–22:00 MSK, занятость,
валидация контактов, длительность 30 минут) реализованы на сервере.

## Быстрые команды

```bash
# установка зависимостей через Poetry (Python 3.14)
poetry install

# юнит-тесты (27 шт.)
poetry run pytest

# dev-сервер на http://localhost:8000 (uvicorn, с авто-reload)
poetry run uvicorn config.asgi:application --reload --port 8000

# prod в Docker — через docker-entrypoint.sh (exec-ENTRYPOINT в backend/Dockerfile):
# uvicorn config.asgi:application --host 0.0.0.0 --port "$PORT" --proxy-headers (PORT, дефолт 8000)

# линтинг и форматирование (из backend/)
poetry run ruff check .
poetry run ruff format .
```

## Docker

`backend/Dockerfile` — отдельный образ API на `$PORT` (дефолт 8000), вход — `docker-entrypoint.sh` (exec-`ENTRYPOINT`).

```bash
docker compose --profile default up backend
# или весь стек:
docker compose --profile default up
```

Полный стек в одном контейнере (nginx + SPA + API) — корневой `Dockerfile`,
см. README репозитория (раздел «Продакшен-образ»).

## Структура

```
backend/
├── config/                  # Django-обвязка (settings, urls, asgi, wsgi)
│   └── urls.py              # одна NinjaAPI; два роутера (/api/event-types, /api/owner)
├── booking/
│   ├── domain.py            # @dataclass(frozen=True): Owner, EventType, Booking, Slot
│   ├── errors.py            # ErrorCode, AppError, STATUS_BY_CODE
│   ├── timeutils.py         # МСК ⇄ UTC helpers, 32-шаговая сетка 06:00..21:30
│   ├── seed.py              # предзаданный владелец id=1
│   ├── app_registry.py      # AppRegistry + bootstrap (Lock + 3 in-memory repo)
│   ├── apps.py              # AppConfig.ready()
│   ├── repositories/        # Protocols + InMemory*Repo под общим Lock
│   ├── services/            # EventTypeService, SlotService, BookingService (clock DI)
│   └── api/                 # транспорт: schema (pydantic v2) + django-ninja routers
└── booking/tests/           # pytest: 5 модулей (CRUD, slots, conflict, window/hours, admin)
```

## Ключевые эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/event-types` | публичный каталог |
| GET | `/api/event-types/{id}` | один тип |
| GET | `/api/event-types/{id}/slots?date=YYYY-MM-DD` | сетка 32 слотов |
| POST | `/api/event-types/{id}/bookings` | создать бронирование |
| GET | `/api/owner/event-types` | CRUD-каталог владельца |
| POST | `/api/owner/event-types` | создать тип (duration_minutes == 30) |
| PUT | `/api/owner/event-types/{id}` | обновить тип |
| DELETE | `/api/owner/event-types/{id}` | 204 |
| GET | `/api/owner/bookings` | предстоящие брони |

Авто-сгенерированная документация: <http://localhost:8000/openapi.json>.

## Тело ошибок (единый формат для фронта)

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed.",
    "details": [{"field": "guest_email", "messages": ["..."]}]
  }
}
```

| Код | HTTP |
|---|---|
| `event_type_not_found`, `booking_not_found` | 404 |
| `slot_taken` | 409 |
| `validation_failed`, `slot_outside_window`, `slot_outside_hours`, `slot_in_past`, `invalid_duration` | 422 |
| `internal_error` | 500 |

## Атомарность занятости

`BookingService.create()` вызывает `InMemoryBookingRepo.reserve()`, который
**под единым `threading.Lock`** проверяет `has_conflict` и вставляет запись.
Это эквивалентно будущему `SELECT ... FOR UPDATE` + `UniqueConstraint(fields=["start_at"])`
на Django ORM. Service-слой не меняется при переходе на БД.

## Сброс данных

Данные живут в памяти процесса gunicorn/uvicorn. Перезапуск = пустое хранилище.

```bash
docker compose restart backend   # очистит всё
```

На следующем шаге сюда подключим PostgreSQL + Django ORM; верхние слои
(`services`, `api`) не меняются.
