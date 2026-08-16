# Запись на звонок

Упрощённый сервис бронирования времени по мотивам Cal.com (v1).
Полная спецификация — в [`spec/01-pdr.md`](spec/01-pdr.md);
frontend‑архитектура — [`spec/02-frontend-architecture.md`](spec/02-frontend-architecture.md);
контракт API — [`spec/api.tsp`](spec/api.tsp) → [`spec/generated/openapi.yaml`](spec/generated/openapi.yaml).

## Структура репозитория

```
spec/                    # источник правды: PRD, контракт OpenAPI, скриншоты
frontend/                # SPA (React 18 + Vite 5 + TanStack Query + shadcn/ui)
backend/                 # Django API (Django 6 + django-ninja + pydantic v2, in-memory)
docker-compose.yml       # два compose‑профиля: default и frontend-only
Dockerfile               # корневой продакшен‑образ (SPA + API в одном контейнере)
docs/devlog/             # журнал заметок по задачам
```

## Запуск

### A. Только фронт + мок Prism (без бэкенда)
```bash
cd spec && npm install && npm run compile
cd ../frontend && npm install
npx -y @stoplight/prism-cli mock ../spec/generated/openapi.yaml --port 4010 --dynamic &
npm run dev         # Vite dev на http://localhost:5173 с прокси /api → 4010
```

В другом терминале — тесты:

```bash
npm run test:unit         # vitest, 20 тестов
npm run build && npm run preview  # production preview на :4173
npm run test:e2e          # Playwright acceptance против реального backend
                          # (поднимает docker compose --profile default; нужен npm run build)
```

### B. Только фронт + мок в Docker
```bash
docker compose --profile frontend-only up
# Поднимется:
# - frontend (3000:8080) — nginx внутри проксирует /api на Prism
# - prism             — мок API на :4010
```

### C. Полный стек
```bash
docker compose --profile default up
# Поднимется:
# - frontend (3000:8080) — nginx внутри проксирует /api на backend:8000
# - backend             — Django API на :8000
# - db (postgres:16)    — БД
```

### D. Продакшен-образ (полный стек в одном контейнере)
Корневой `Dockerfile` собирает SPA и API в один образ: nginx отдаёт фронтенд и
проксирует `/api` на локальный Django-API. Порт задаётся переменной `PORT`
(по умолчанию `8000`):
```bash
docker build -t booking-service .
docker run --rm -p 8080:8080 -e PORT=8080 booking-service
# http://localhost:8080 — SPA, http://localhost:8080/api/event-types — API
```

## Переменные окружения

| ENV | Назначение | Значение по умолчанию |
|---|---|---|
| `VITE_API_BASE_URL` | Базовый путь API на клиенте | `/api` |
| `API_PROXY_TARGET`  | Куда Vite‑proxy пересылает `/api` во время dev/preview | `http://localhost:4010` |
| `PORT`              | Порт корневого продакшен‑образа (nginx) | `8000` |

В Docker nginx обслуживает `/api` через свой `proxy_pass` (композиция выбирает между `backend:8000` и `prism:4010`).

## Основные npm‑скрипты (`frontend/`)

- `npm run dev` — Vite dev c proxy на Prism
- `npm run mock:contract` — smoke‑проверка контракта (поднимает Prism, дёргает `GET /api/event-types`)
- `npm run gen:api` — перегенерация `src/api/generated/schema.d.ts`
- `npm run build` — `gen:api && tsc -b && vite build`
- `npm run preview` — production preview на :4173
- `npm run typecheck / lint / test:unit / test:e2e`

## Соглашения

- Все сетевые вызовы идут через `src/api/client.ts` (`openapi-fetch`) и автоматически превращают не‑2xx ответ в `AppError(status, ErrorBody)`.
- Карта `ErrorCode → русский текст` живёт в [`src/api/errors.ts`](frontend/src/api/errors.ts).
- Все производные «сегодня» и «граница 14 дней» используют `date-fns-tz` c `Europe/Moscow`.
- UI‑компоненты — копия shadcn/ui в [`src/components/ui/`](frontend/src/components/ui/). Никаких глобальных state‑менеджеров сверх TanStack Query + React Context.

## CI и релизы

- `.github/workflows/ci.yml` — интеграционные проверки на каждый PR к `main` и push в `main`: компиляция TypeSpec-контракта, линт/typecheck/юнит‑тесты/сборка фронтенда, ruff/pytest бэкенда, e2e‑тесты Playwright против реального стека (`docker compose --profile default`).
- `release-please` (`.github/workflows/release-please.yml`) — после мёржа в `main` создаёт/обновляет release‑PR с `CHANGELOG.md` и предложенной версией (conventional commits); после мёржа release‑PR формирует тег `vX.Y.Z` и GitHub Release.

## Статус

Реализовано: SPA, API‑слой, юнит‑тесты (Vitest), e2e (Playwright), Docker‑конфигурация, CI и автоматические релизы через release-please. См. [`docs/devlog/0001-frontend-impl.md`](docs/devlog/0001-frontend-impl.md) и [`docs/devlog/0006-ci-and-release-please.md`](docs/devlog/0006-ci-and-release-please.md).
