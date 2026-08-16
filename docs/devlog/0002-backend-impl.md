# Реализация backend «Запись на звонок» (v1, in-memory)

## 🎯 Проблема
Нужен backend, который:
- реализует API по контракту `spec/api.tsp` (TypeSpec → OpenAPI 3.0 в `spec/generated/openapi.yaml`);
- живёт в отдельном Docker-сервисе рядом с уже готовым frontend и подключается в compose-профиль `default`;
- держит все ключевые бизнес-правила бронирования на сервере (окно 14 дней, MSK-часы 06:00–22:00, занятость start_at, длительность 30 минут, валидация контактов);
- в v1 обходится без БД — данные в памяти одного процесса, рестарт = сброс.

Frontend уже работает против Prism-мока по тому же контракту, поэтому новая реализация должна быть совместима с типами из `src/api/generated/schema.d.ts`.

## ✅ Решение
Создан self-contained Django 6 бэкенд в `backend/`:
- `Python 3.14` + `Poetry` + `pydantic v2` + `django-ninja`;
- Доменный слой — `@dataclass(frozen=True)` + `Protocol`-репозитории; pydantic только в API-слое;
- Хранилище — `InMemoryEventTypeRepo` и `InMemoryBookingRepo` под общим `threading.Lock`;
- Атомарная проверка занятости через `InMemoryBookingRepo.reserve()` — комбинация `has_conflict`+`add` под одним lock-ом. На следующем шаге заменяется на `transaction.atomic` + `UniqueConstraint(fields=["start_at"])` без правки service-слоя;
- 6 эндпоинтов (4 public + 6 owner, как в OpenAPI), один `NinjaAPI` с двумя роутерами, префиксы URL побайтово совпадают с TypeSpec;
- Глобальные обработчики `AppError` + `ninja.errors.ValidationError` нормализуют все ответы в формат `ErrorBodyOut` (`code`, `message`, `details`), как ждёт фронт;
- 27 pytest-тестов (CRUD, slot-grid, конфликт, окно/часы/past, admin) — все зелёные;
- Multi-stage Dockerfile (python:3.14-slim + poetry → wheels → runtime + gunicorn) + `backend/README.md` с командами;
- Решена проблема с `pydantic_core.ValidationError`: django-ninja оборачивает её в свой `ninja.errors.ValidationError`, обработчик зарегистрирован на этот тип и возвращает единый формат.

## 📝 Изменённые файлы
### Новые
1. `backend/pyproject.toml` — Poetry-манифест (Django 6, django-ninja, pydantic[email], gunicorn, uvicorn[standard], pytest, ruff)
2. `backend/poetry.lock` — lock-файл зависимостей
3. `backend/Dockerfile` — multi-stage, gunicorn в CMD, healthcheck на `/api/event-types`
4. `backend/.dockerignore`, `backend/ruff.toml`, `backend/pytest.ini`, `backend/manage.py`, `backend/README.md`
5. `backend/config/__init__.py`, `settings.py`, `urls.py` (NinjaAPI + exception handlers), `asgi.py`, `wsgi.py`
6. `backend/booking/__init__.py`, `apps.py`, `app_registry.py`, `domain.py`, `errors.py`, `timeutils.py`, `seed.py`
7. `backend/booking/repositories/{__init__,base,memory}.py` — `InMemory*Repo` под общим `threading.Lock`, метод `reserve()` для атомарного бронирования
8. `backend/booking/services/{__init__,event_types,slots,bookings}.py` — бизнес-правила, clock DI (Callable[[], datetime])
9. `backend/booking/api/deps.py`, `api/public/{__init__,schemas,router,urls}.py`, `api/owner/{__init__,schemas,router,urls}.py`
10. `backend/booking/tests/{__init__,conftest,test_event_types_crud,test_slot_grid,test_booking_conflict,test_window_hours_past,test_admin_bookings}.py`

### Не тронуты
- `docker-compose.yml` (сервис `backend: dev, profile=default, expose=8000` уже был на месте);
- `frontend/`, `Dockerfile.frontend`, `nginx*.conf`;
- `spec/`, `spec/generated/openapi.yaml`, контракт.

## 🚀 Как протестировать

### Юнит-тесты
```bash
cd backend && poetry install
poetry run pytest          # 27 passed
```

### Локальный сервер (uvicorn, dev)
```bash
cd backend
poetry run uvicorn config.asgi:application --reload --port 8000
curl http://localhost:8000/openapi.json | jq '.paths | keys'
```

### Полный стек (Docker)
```bash
docker compose --profile default up
# подымаются: frontend (3000), backend (8000), db (5432)
```

### Ручные smoke-команды (по чек-листу готовности из §14 архитектуры)
```bash
# Owner: создать тип события
curl -X POST http://localhost:8000/api/owner/event-types \
  -H 'Content-Type: application/json' \
  -d '{"name":"Встреча 30 мин","description":"Demo","duration_minutes":30}'
# → {"id":1,...}

# Guest: сетка слотов на завтра
curl 'http://localhost:8000/api/event-types/1/slots?date=2026-08-13'

# Guest: бронь на 10:00 МСК
START=$(curl 'http://localhost:8000/api/event-types/1/slots?date=2026-08-13' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(s for s in d if s['status']=='free')['start_at'])")
curl -X POST http://localhost:8000/api/event-types/1/bookings \
  -H 'Content-Type: application/json' \
  -d "{\"guest_name\":\"Ann\",\"guest_email\":\"ann@example.com\",\"start_at\":\"$START\"}"
# → 200 + BookingConfirmation (id, event_type, start_at, end_at=start+30m, created_at)

# Тот же слот ещё раз → 409 slot_taken
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/event-types/1/bookings \
  -H 'Content-Type: application/json' \
  -d "{\"guest_name\":\"Bob\",\"guest_email\":\"bob@example.com\",\"start_at\":\"$START\"}"
# → 409
```

### Линт
```bash
cd backend
poetry run ruff check .     # All checks passed!
poetry run ruff format .    # 7 files reformatted, 30 left unchanged
```

## ⚙️ Важные детали

### Атомарность занятости
`BookingService.create()` вызывает `InMemoryBookingRepo.reserve(booking_draft)`, который **под единым `threading.Lock`** проверяет `has_conflict(start_at)` и вставляет запись с авто-id. Возвращает сохранённый `Booking` или `None` при конфликте. Service-слой не меняется при переходе на PostgreSQL.

### Clock DI
Сервисы принимают `Callable[[], datetime]` через конструктор (`SlotService(clock=...)`, `BookingService(clock=...)`). По умолчанию — `booking.timeutils.now_utc`. В тестах `monkeypatch` подменяет `booking.timeutils.now_utc` на фиксированную дату — без `freezegun` и без глобальных setattr.

### Удалённый event_type и список броней
В in-memory у `Booking` нет snapshot имени типа. `BookingService.list_upcoming_admin()` подставляет `"<удалён>"`, если `EventTypeRepo.get(b.event_type_id) is None` — соответствует OpenAPI (поле не nullable).

### Ошибочный формат ответа
Все ошибки (включая pydantic-валидацию из тела POST) уходят в единой форме:
```json
{"error": {"code": "validation_failed", "message": "...", "details": [{"field": "guest_email", "messages": ["..."]}]}}
```
Реализовано через `@api.exception_handler(ninja.errors.ValidationError)` — django-ninja оборачивает `pydantic.ValidationError` в свой класс; обработчик аккуратно парсит `loc[2:]` и возвращает имя поля без префикса параметра-фантома.

### N+1 query
В v1 in-memory: `GET /api/owner/bookings` читает EventType для каждой брони; на тестах OK. На следующем шаге в ORM — `select_related("event_type")`.

### URL vs query params в тестах
`ninja.testing.TestClient` принимает query-параметры либо в строке URL (`?date=…`) либо через `query_params=`. Тесты используют первый вариант — ближе к реальному фронту.

## 🎉 Итог
Backend готов и подымается через `docker compose --profile default up`. Все 6 эндпоинтов OpenAPI работают, все правила (окно/часы/past/conflict) проверяются на сервере, 27 тестов зелёные, `ruff check` чистый. Frontend-контракт совпадает побайтово с `spec/generated/openapi.yaml`, поэтому frontend переключается с Prism на реальный бэкенд просто через `docker compose --profile default up` без правки своего кода.

Все ручные smoke из чек-листа готовности §14 архитектуры прошли: создание типа, GET слотов, успешная бронь, повторная бронь → 409 `slot_taken`, список админа.
