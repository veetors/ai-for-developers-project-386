# Архитектура бэкенда «Запись на звонок» (v1, in‑memory)

> Этап проектирования бэкенда v1. Основано на PRD (`spec/01-pdr.md`), API‑контракте (`spec/api.tsp`) и сгенерированном OpenAPI (`spec/generated/openapi.yaml`). Документ зеркалит границу, заданную фронтенд‑архитектурой (`spec/02-frontend-architecture.md`).
>
> Стек: **Python 3.14, Poetry, Django 6, django-ninja, pydantic v2**. Хранилище — in-memory за протоколом `Repository` (без БД на этом шаге).

---

## 1. Контекст и принципы

- Бэкенд — самостоятельный сервис Docker (compose‑профиль `default`). Поднимается вместе с фронтом; фронт ходит к нему по `/api` либо напрямую в dev, либо через `nginx` из compose‑профиля `default`. Отдельный продакшен‑вариант — корневой multi‑stage `Dockerfile` (nginx + SPA + API в одном контейнере).
- Единственный клиент — SPA из `02-frontend-architecture.md`. Других потребителей не предполагается, поэтому никакой другой публичной документации сверх `spec/api.tsp` не публикуем.
- На этом шаге **нет БД**. Хранилище — оперативная память одного процесса; перезапуск контейнера = сброс данных. Все данные идут через интерфейсы `Repository`; на следующем шаге они заменяются на Django ORM без изменений сервисного и транспортного слоя.
- Все бизнес-правила (окно 14 дней, рабочие часы 06:00–22:00 MSK, занятость, длительность 30 минут, валидация контактов) реализуются **только** на сервере. Фронт лишь отображает `status: free|busy`.
- В v1 нет авторизации. Разделение public/owner — инфраструктурное: разные URL-префиксы, разные URLConf, раздельные Ninja-роутеры. Никаких middleware с проверкой ролей не добавляем.
- PDR называет «Django + Django ORM + PostgreSQL». На этом шаге ORM не используется; архитектура построена так, чтобы переход на ORM не переписывал верхние слои.

---

## 2. Технологический стек

| Слой | Технология | Назначение |
|---|---|---|
| Язык | Python 3.14 | основной runtime |
| Зависимости | Poetry (`pyproject.toml`, `poetry.lock`) | lock + окружения |
| Web-фреймворк | Django 6.x | URL routing, settings, AppConfig, WSGI/ASGI |
| REST | **django-ninja** | декларативные роутеры, pydantic v2-схемы, авто-OpenAPI |
| Валидация | **pydantic v2** (`Field(min_length, max_length, EmailStr)`) | guest_email, длина name, duration |
| CORS | `django-cors-headers` | для локального фронт-dev |
| HTTP-серверы | **uvicorn** (ASGI) — dev и Docker‑прод (через `docker-entrypoint.sh`, `$PORT`); gunicorn (WSGI) в образах не используется | разделение dev/prod |
| Тесты | **pytest + pytest-django** (только) | API tests |
| Линт/формат | ruff, ruff-format | единый стиль |
| Контейнеризация | `backend/Dockerfile` (compose) + корневой multi-stage `Dockerfile` | деплой |

DRF не используется. pydantic не применяется в доменном слое — там остаются `@dataclass(frozen=True)`.

---

## 3. Структура проекта `backend/`

```
backend/
├── pyproject.toml
├── poetry.lock
├── Dockerfile
├── docker-entrypoint.sh            # exec-ENTRYPOINT: uvicorn на $PORT (дефолт 8000)
├── .dockerignore
├── ruff.toml
├── pytest.ini
├── manage.py                          # только для collectstatic / shell; runserver не исп.
├── README.md
├── config/                            # Django settings package
│   ├── __init__.py
│   ├── settings.py                    # SECRET_KEY, DEBUG, ALLOWED_HOSTS, INSTALLED_APPS, CORS
│   ├── urls.py                        # подключает public.router + owner.router → один NinjaAPI
│   ├── wsgi.py                        # sync-stack (gunicorn вне Docker)
│   └── asgi.py                        # uvicorn: dev и Docker-прод
└── booking/                           # основной доменный Django-app
    ├── __init__.py
    ├── apps.py                        # AppConfig.ready() → bootstrap репозиториев + seed Owner
    ├── domain.py                      # dataclasses: Owner, EventType, Booking, Slot
    ├── errors.py                      # ErrorCode, FieldError, AppError + status_code map
    ├── timeutils.py                   # MSK/UTC helpers
    ├── seed.py                        # сид владельца (id=1); без демо-типов
    ├── repositories/
    │   ├── __init__.py
    │   ├── base.py                    # Protocols (OwnerRepo, EventTypeRepo, BookingRepo)
    │   └── memory.py                  # InMemory реализации + threading.Lock
    ├── services/
    │   ├── __init__.py
    │   ├── event_types.py             # CRUD + проверка duration==30
    │   ├── slots.py                   # построение сетки 30 мин, пометка busy
    │   └── bookings.py                # создание брони + атомарная проверка start_at
    ├── api/
    │   ├── __init__.py
    │   ├── deps.py                    # Depends-функции для сервисов
    │   ├── public/
    │   │   ├── __init__.py
    │   │   ├── schemas.py             # EventTypeOut, SlotOut, BookingRequestIn, BookingConfirmationOut, FieldErrorOut, ErrorBodyOut
    │   │   ├── router.py              # Ninja Router под /api/event-types/...
    │   │   └── urls.py                # Python-переменная public_router для корневого NinjaAPI
    │   └── owner/
    │       ├── __init__.py
    │       ├── schemas.py             # EventTypeOut, EventTypeIn, AdminBookingOut
    │       ├── router.py
    │       └── urls.py
    └── tests/
        ├── __init__.py
        ├── conftest.py                # pytest-django: DJANGO_SETTINGS, reset_repos
        ├── test_event_types_crud.py
        ├── test_slot_grid.py
        ├── test_booking_conflict.py
        ├── test_window_hours_past.py
        └── test_admin_bookings.py
```

Composition root — `booking.apps.BookingConfig.ready()`: создаёт единственный набор in-memory репозиториев, держит общий `threading.Lock` и публикует их через `booking.app_registry`. Сервисы получают репозитории через фабрики в `booking.api.deps` (через `Depends`).

---

## 4. Доменная модель

Внутренние типы — `@dataclass(frozen=True)` (имутабельность упрощает рассуждение и тесты). Сериализацию делают pydantic-схемы в API-слое.

```python
# booking/domain.py
@dataclass(frozen=True)
class Owner:
    id: int                     # всегда 1
    name: str
    timezone: str               # "Europe/Moscow"

@dataclass(frozen=True)
class EventType:
    id: int
    owner_id: int               # = 1
    name: str
    description: str
    duration_minutes: int       # = 30 в v1; поле хранится

@dataclass(frozen=True)
class Booking:
    id: int
    event_type_id: int
    guest_name: str
    guest_email: str
    start_at: datetime          # UTC tz-aware
    end_at: datetime            # start_at + duration_minutes
    created_at: datetime        # UTC tz-aware, серверное время
```

`Slot` — вычисляемая сущность, в коллекциях не хранится:

```python
@dataclass(frozen=True)
class Slot:
    start_at: datetime          # UTC
    end_at: datetime            # UTC, start_at + duration_minutes
    status: Literal["free", "busy"]
```

---

## 5. Слой persistence (in-memory)

```python
# booking/repositories/base.py
class OwnerRepo(Protocol):
    def get_default(self) -> Owner: ...

class EventTypeRepo(Protocol):
    def list(self) -> list[EventType]: ...
    def get(self, id: int) -> EventType | None: ...
    def add(self, et: EventType) -> EventType: ...
    def update(self, et: EventType) -> EventType | None: ...
    def delete(self, id: int) -> bool: ...

class BookingRepo(Protocol):
    def list_upcoming(self, now: datetime) -> list[Booking]: ...
    def get(self, id: int) -> Booking | None: ...
    def has_conflict(self, start_at: datetime) -> bool: ...
    def add(self, booking: Booking) -> Booking: ...
```

In-memory реализации (фрагмент):

```python
# booking/repositories/memory.py
class InMemoryEventTypeRepo:
    def __init__(self, lock):
        self._lock = lock
        self._by_id: dict[int, EventType] = {}
        self._next_id: int = 1
    # CRUD с автоинкрементом id под единым lock

class InMemoryBookingRepo:
    def __init__(self, lock):
        self._lock = lock
        self._by_id: dict[int, Booking] = {}
        self._next_id: int = 1

    def has_conflict(self, start_at):
        with self._lock:
            return any(b.start_at == start_at for b in self._by_id.values())

    def add(self, booking):
        with self._lock:
            self._by_id[booking.id] = booking
            return booking
```

`has_conflict` + `add` всегда удерживают один и тот же `lock` — это даёт **атомарную** проверку занятости в одном процессе. Поведение эквивалентно будущему `SELECT … FOR UPDATE` + `UniqueConstraint(fields=["start_at"])` на Django ORM.

---

## 6. Time / MSK ↔ UTC

Все моменты в API и в коллекциях — `datetime` с `tzinfo=UTC`. Граница «сегодня» и границы рабочих часов считаются в MSK, но сравнения делаются в UTC, чтобы исключить дрейф DST.

```python
# booking/timeutils.py
MSK = ZoneInfo("Europe/Moscow")
WORK_START = time(6, 0)
WORK_END   = time(22, 0)
GRID_MINUTES = 30

def now_utc() -> datetime: ...                            # tz-aware UTC
def today_msk(now_utc) -> date: ...
def window_dates_msk(now_utc) -> tuple[date, date]: ...   # (today, today+13)
def combine_msk_to_utc(d: date, t: time) -> datetime: ...
def parse_query_date(s: str) -> date: ...                 # YYYY-MM-DD
def duration_minutes_for(et: EventType) -> timedelta: ...
def is_within_work_hours_msk(dt_utc: datetime) -> bool: ...
```

Алгоритм построения сетки дня (для `slots`): берём `date` (MSK), генерируем 32 шага по 30 минут в диапазоне 06:00–21:30 MSK (`start ∈ [06:00, 06:30, …, 21:30]`, `end = start + 30m`); последний `end` == 22:00 MSK. Конвертация в UTC, пометка `busy` если `start_at < now_utc` или есть `Booking` с тем же `start_at`.

---

## 7. Слой services (бизнес-логика)

```python
class EventTypeService:
    def list_all(self) -> list[EventType]: ...
    def get(self, id) -> EventType: ...                       # raise AppError(event_type_not_found, 404)
    def create(self, input: EventTypeIn) -> EventType: ...   # duration_minutes != 30 → invalid_duration (422)
    def update(self, id, input) -> EventType: ...             # та же проверка duration
    def delete(self, id) -> None: ...

class SlotService:
    def grid_for_day(self, event_type_id: int, date_ymd: str) -> list[Slot]:
        # 1. event_type или event_type_not_found (404)
        # 2. date ∈ window → slot_outside_window (422)
        # 3. сгенерировать 32 слота 06:00–21:30 MSK
        # 4. каждому присвоить free/busy

class BookingService:
    def list_upcoming_admin(self) -> list[AdminBookingRow]: ...
    def create(self, event_type_id: int, request: BookingRequestIn) -> Booking:
        # 1. event_type → 404
        # 2. start_at future?  → slot_in_past (422)
        # 3. start_at в window → slot_outside_window (422)
        # 4. start_at в рабочих часах MSK → slot_outside_hours (422)
        # 5. has_conflict → slot_taken (409)
        # 6. add Booking (end_at = start_at + duration_minutes)
        # 7. вернуть BookingConfirmation
```

`AdminBookingRow` собирается в сервисе как `(Booking, EventType)`; сериализатор раскладывает в `AdminBookingOut` с `event_type_id` + `event_type_name` (без вложенного `event_type` — как в OpenAPI). Сортировка: по `start_at` по возрастанию; только `start_at ≥ now_utc`.

---

## 8. Слой API — django-ninja

### 8.1 Схемы (pydantic v2)

```python
# booking/api/public/schemas.py
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

class EventTypeOut(BaseModel):
    id: int
    name: str
    description: str
    duration_minutes: int

class SlotOut(BaseModel):
    start_at: datetime
    end_at: datetime
    status: Literal["free", "busy"]

class BookingRequestIn(BaseModel):
    guest_name: str = Field(..., min_length=1, max_length=200)
    guest_email: EmailStr
    start_at: datetime

class BookingConfirmationOut(BaseModel):
    id: int
    event_type: EventTypeOut
    guest_name: str
    guest_email: str
    start_at: datetime
    end_at: datetime
    created_at: datetime

class FieldErrorOut(BaseModel):
    field: str
    messages: list[str]

class ErrorBodyOut(BaseModel):
    code: ErrorCodeEnum          # enum из errors.py
    message: str
    details: list[FieldErrorOut] | None = None
```

Аналогично `EventTypeIn` (для owner) с `duration_minutes: int` и валидацией в сервисном слое (30); `AdminBookingOut` с восемью плоскими полями.

> `EmailStr` даёт более жёсткую проверку, чем `format=email`. Используем `EmailStr` (от pydantic-extra). Подходит для UI-валидации на стороне Python.

### 8.2 Роутеры

```python
# booking/api/public/router.py
from ninja import Router
router = Router()

@router.get("/event-types", response=list[EventTypeOut])
def list_event_types(request): ...

@router.get("/event-types/{id}", response=EventTypeOut | ErrorResponse)
def get_event_type(request, id: int): ...

@router.get("/event-types/{id}/slots",
            response=list[SlotOut] | ErrorResponse)
def get_slots(request, id: int, date: str): ...

@router.post("/event-types/{id}/bookings",
             response=BookingConfirmationOut | ErrorResponse)
def create_booking(request, id: int, payload: BookingRequestIn): ...
```

```
booking/api/owner/router.py
@router.get("/event-types", response=list[EventTypeOut])
@router.post("/event-types", response=EventTypeOut | ErrorResponse)
@router.get("/event-types/{id}", response=EventTypeOut | ErrorResponse)
@router.put("/event-types/{id}", response=EventTypeOut | ErrorResponse)
@router.delete("/event-types/{id}", response={204: None} | ErrorResponse)
@router.get("/bookings", response=list[AdminBookingOut])
```

### 8.3 Зависимости

```python
# booking/api/deps.py
def get_event_type_service():
    return EventTypeService(
        event_types=app_registry.event_types,
        owner=app_registry.owner,
    )

def get_slot_service():
    return SlotService(
        event_types=app_registry.event_types,
        bookings=app_registry.bookings,
        clock=now_utc,
    )

def get_booking_service():
    return BookingService(
        event_types=app_registry.event_types,
        bookings=app_registry.bookings,
        clock=now_utc,
    )
```

### 8.4 Монтаж в Django

```python
# config/urls.py
from booking.api.public.urls import router as public_router
from booking.api.owner.urls   import router as owner_router

api = NinjaAPI()
api.add_router("/api/event-types", public_router, tags=["public"])
api.add_router("/api/owner",        owner_router,  tags=["owner"])
urlpatterns = [path("", api.urls)]
```

URL-префиксы совпадают с OpenAPI один в один.

---

## 9. Обработка ошибок

```python
# booking/errors.py
class ErrorCode(str, Enum):
    validation_failed      = "validation_failed"
    slot_outside_window    = "slot_outside_window"
    slot_outside_hours     = "slot_outside_hours"
    slot_in_past           = "slot_in_past"
    slot_taken             = "slot_taken"
    event_type_not_found   = "event_type_not_found"
    booking_not_found      = "booking_not_found"
    invalid_duration       = "invalid_duration"
    internal_error         = "internal_error"

STATUS_BY_CODE = {
    ErrorCode.event_type_not_found: 404,
    ErrorCode.slot_taken: 409,
    # остальные коды → 422
}

class AppError(Exception):
    code: ErrorCode
    message: str
    details: list[FieldError] | None
```

Один глобальный обработчик на уровне `NinjaAPI` плюс отдельный для pydantic-валидации (для единого формата с фронтом):

```python
@api.exception_handler(AppError)
def handle_app_error(request, exc: AppError):
    return api.create_response(
        request,
        {"error": {"code": exc.code.value,
                   "message": exc.message,
                   "details": [d.model_dump() for d in (exc.details or [])]}},
        status=STATUS_BY_CODE[exc.code],
    )

@api.exception_handler(ValidationError)   # pydantic
def handle_pydantic_validation(request, exc):
    details = [...]
    return api.create_response(
        request,
        {"error": {"code": "validation_failed",
                   "message": "Request validation failed.",
                   "details": details}},
        status=422,
    )
```

Последний гарантирует, что pydantic-ошибки (например, `guest_name` 0 символов, неверный email) приходят как `ErrorBody(code=validation_failed, details=[{field, messages}])` — ровно как зафиксировано в `02-frontend-architecture.md` §5.3.

Связь `ErrorCode ↔ HTTP-статус` хранится в `errors.py` и используется сервисами при выбросе:

| Exception | `code` | HTTP |
|---|---|---|
| event_type не найден | `event_type_not_found` | 404 |
| date вне окна | `slot_outside_window` | 422 |
| время вне 06:00–22:00 MSK | `slot_outside_hours` | 422 |
| start_at в прошлом | `slot_in_past` | 422 |
| duration_minutes ≠ 30 | `invalid_duration` | 422 |
| не прошёл email/длина name | `validation_failed` | 422 |
| конфликт занятости start_at | `slot_taken` | 409 |

---

## 10. Конфигурация и bootstrap

- `config/settings.py`: минимальные INSTALLED_APPS: `django.contrib.contenttypes` (нужен некоторым частям Django internals, но без таблиц — `databases["default"] = {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}` или явно пустой engine; не критично, миграций нет), `corsheaders`, `booking.apps.BookingConfig`.
- `BookingConfig.ready()` создаёт `app_registry` с `Owner` (id=1, name="Host", tz="Europe/Moscow"), чистыми репозиториями, общим `lock`. Без сидов демо-типов (создаются владельцем через API).
- `ALLOWED_HOSTS = ["*"]` в dev; `"backend"` в compose-профиле `default`.

---

## 11. Запуск и Docker

`config/asgi.py`:

```python
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_asgi_application()
```

`config/wsgi.py` — sync-stack (для gunicorn вне Docker).

Dev (вне Docker): **uvicorn**

```
uvicorn config.asgi:application --reload --host 0.0.0.0 --port 8000
```

(`runserver` Django-вариант остаётся доступным, но в README указываем uvicorn как основной путь: ASGI даёт корректный `openapi.json` и быстрее под reload.)

Prod в Docker — через `docker-entrypoint.sh` (exec-`ENTRYPOINT` в `backend/Dockerfile`):

```
uvicorn config.asgi:application --host 0.0.0.0 --port "$PORT" --proxy-headers
```

(`$PORT`, дефолт 8000; `EXPOSE 8000` информационно.)

`backend/Dockerfile` — multi-stage на `python:3.14-slim`, Poetry export → `pip wheel` → установка колёс, копирование исходников.

Отдельный продакшен‑образ всего стека — корневой `Dockerfile`: nginx отдаёт SPA и
проксирует `/api` и `/healthz` на Django‑API, который слушает unix‑сокет
`/tmp/booking-api.sock` (исключает коллизию с `listen $PORT`). Вход —
`docker-entrypoint.sh`: uvicorn `--uds` → wait‑ready через curl → `envsubst
'${PORT}'` → `nginx -g 'daemon off;'`.

---

## 12. Тесты

**Только pytest + pytest-django**. `manage.py test` не используется. `pytest.ini`:

```
DJANGO_SETTINGS_MODULE = config.settings
addopts = -q
```

`conftest.py`:

```python
import pytest
from booking import app_registry

@pytest.fixture(autouse=True)
def reset_repos():
    app_registry.reset()
```

Клиент:

```python
from ninja.testing import TestClient
from config.asgi import api
client = TestClient(api)
```

Используем sync-вариант. Проверяется по `pytest` в CI.

Тестовые сценарии:

1. **test_event_types_crud.py** — owner создаёт/получает/обновляет/удаляет тип; `duration_minutes≠30` → 422 `invalid_duration`; удаление не отменяет существующих броней (snapshot `event_type_name`).
2. **test_slot_grid.py** — для `date=today` и `date=tomorrow` 32 слота с `end = start + 30m`; слоты в прошлом → `busy`; при существующей брони слот → `busy`; вне окна → 422 `slot_outside_window`; для несуществующего `event_type_id` → 404 `event_type_not_found`.
3. **test_booking_conflict.py** — два последовательных `POST` с одним `start_at`: первый 200 (`BookingConfirmation`), второй 409 `slot_taken` (lock в `InMemoryBookingRepo.has_conflict`+`add`).
4. **test_window_hours_past.py** — POST с `start_at` за пределами 22:00 MSK → 422 `slot_outside_hours`; со вчерашней датой → 422 `slot_outside_window`; с `start_at` несколько секунд назад → 422 `slot_in_past`; с email `not-an-email` → 422 `validation_failed` с `details[].field="guest_email"`; с `guest_name=""` → 422 `validation_failed` с `details[].field="guest_name"`.
5. **test_admin_bookings.py** — `GET /api/owner/bookings` возвращает только `start_at ≥ now`, отсортировано по возрастанию; после удаления типа события брони остаются с правильным `event_type_name`.

---

## 13. Точки риска

1. **`EmailStr` требует `email-validator`.** В `pyproject.toml` — обязательная зависимость.
2. **pydantic-datetime в OpenAPI.** Моменты хранятся и возвращаются как `datetime` с `tzinfo=UTC`. Любая naive-datetime → OpenAPI без timezone; цена — рассинхрон с фронтом по `Date()`-парсингу.
3. **pydantic ValidationError → формат.** Без отдельного `exception_handler` фронт получит «сырой» ответ pydantic. Поэтому нормализуем в обработчике (см. §9).
4. **Гонка за слот.** В этом шаге — `threading.Lock` + линейное сканирование. На следующем шаге с Django ORM — `SELECT … FOR UPDATE` + `UniqueConstraint("start_at")`. Service не меняется.
5. **Перезапуск контейнера = сброс.** Данные не персистентны. Это явно сказано в требованиях шага; для CI e2e — нормально; для production — следующий шаг.

---

## 14. План реализации

1. `pyproject.toml` (Poetry): Python 3.14, Django 6, django-ninja, pydantic v2, gunicorn, uvicorn[standard], email-validator, pytest, pytest-django, ruff. Локальная установка через `poetry install`.
2. `config/`: `settings.py`, `urls.py`, `wsgi.py`, `asgi.py`.
3. `booking/`: `domain.py`, `errors.py`, `timeutils.py`, `repositories/{base,memory}.py`, `app_registry.py`, `seed.py`, `apps.py`.
4. `services/`: `event_types.py`, `slots.py`, `bookings.py` — с покрытием всех правил и exception-сценариев.
5. `api/public/schemas.py` + `router.py`; `api/owner/schemas.py` + `router.py`; `api/deps.py`; `api/errors.py`; `urls.py` каждой части.
6. `pytest.ini` + `tests/conftest.py` + 5 тест-модулей; прогон `pytest`.
7. `Dockerfile` и `.dockerignore`; проверка `docker compose up` (вместе с фронтом, по `02-frontend-architecture.md` §9.3).
8. `ruff check`/`ruff format` чистый проход перед PR.

Чек-лист готовности шага:
- [ ] `poetry run pytest` зелёный.
- [ ] `uvicorn config.asgi:application` стартует, `/api/openapi.json` валиден.
- [ ] Ручные смоук: `GET /api/event-types`, `POST /api/event-types/{id}/bookings` (успех), повторный POST с тем же `start_at` → 409.
- [ ] `ruff check` чисто.

---

## 15. Соответствие требованиям задания

- ✅ API соответствует `spec/api.tsp` (пути, схемы, коды, `ErrorCode`).
- ✅ API предназначен для отдельного фронт-клиента; фронт живёт в своём сервисе.
- ✅ Все ключевые правила бронирования (окно, часы, занятость, длительность, валидация контактов) — серверные.
- ✅ Без отдельной БД; in-memory хранилище сбрасывается при рестарте.
- ✅ PDR-стек сохранён (Python, Poetry, Django); ORM не используется только на этом шаге, архитектура готова к включению ORM.
- ✅ Никакой избыточной микросервисности, никакой авторизации в v1.

---

## 16. Дальнейшие шаги за пределами этого этапа

- Перевод с `InMemory*Repo` на Django ORM + PostgreSQL. Service-слой не меняется. В `InMemoryBookingRepo.has_conflict`+`add` заменить `threading.Lock` на `transaction.atomic()` + `UniqueConstraint(fields=["start_at"])`. В `InMemoryEventTypeRepo` — стандартный `Model.get/add/update/delete`.
- Включение миграций и сида (один фикстуре-сид с `Owner(id=1)`).
- Замена владельца на полноценного пользователя с авторизацией — отдельный шаг вне v1.
- Расширение домена (другие длительности, разные рабочие часы по дням недели) — требует расширения `api.tsp` и схем данных, сильного изменения сервисов не предполагается.
