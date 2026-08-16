# Запись на звонок

Упрощённый сервис бронирования времени по мотивам Cal.com (v1).
Полная спецификация — в [`spec/01-pdr.md`](spec/01-pdr.md);
frontend‑архитектура — [`spec/02-frontend-architecture.md`](spec/02-frontend-architecture.md);
контракт API — [`spec/api.tsp`](spec/api.tsp) → [`spec/generated/openapi.yaml`](spec/generated/openapi.yaml).

Деплой: [https://booking-service-3k4r.onrender.com](https://booking-service-3k4r.onrender.com)

## Структура репозитория

```
spec/                    # источник правды: PRD, контракт OpenAPI, скриншоты
frontend/                # SPA (React 18 + Vite 5 + TanStack Query + shadcn/ui)
backend/                 # Django API (Django 6 + django-ninja + pydantic v2, in-memory)
docker-compose.yml       # два compose‑профиля: default и frontend-only
Dockerfile               # корневой продакшен‑образ (SPA + API в одном контейнере)
render.yaml              # Blueprint деплоя на Render (runtime docker, PORT)
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

## Деплой на Render

В корне лежит [`render.yaml`](render.yaml) — Blueprint Render
(Infrastructure‑as‑Code): веб‑сервис `booking-service` (`runtime: docker`) собирает
корневой `Dockerfile` и запускается на порту из переменной `PORT`, которую Render
инжектит сам (по умолчанию `10000`); `docker-entrypoint.sh` рендерит nginx на
`listen ${PORT}`.

```yaml
services:
  - type: web
    name: booking-service
    runtime: docker
    branch: main
    region: frankfurt
    plan: free
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /healthz
    autoDeploy: true
    envVars:
      - key: DJANGO_DEBUG
        value: "0"
```

Развернуть:

```bash
# 1. Запушить render.yaml в main
# 2. Открыть deeplink Blueprint и нажать Apply:
#    https://dashboard.render.com/blueprint/new?repo=https://github.com/veetors/ai-for-developers-project-386
# 3. Дождаться статуса Live (healthcheck /healthz)
```

Проверка после деплоя:

```bash
curl -s https://booking-service-3k4r.onrender.com/                  # 200 SPA
curl -s https://booking-service-3k4r.onrender.com/healthz           # {"status": "ok"}
curl -s https://booking-service-3k4r.onrender.com/api/event-types   # 200 JSON
```

Авто‑деплой на каждый push в `main`. Примечание: на free‑плане сервис засыпает
после ~15 минут без трафика, первый запрос после пробуждения может занять до минуты.

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

Реализовано: SPA, API‑слой, юнит‑тесты (Vitest), e2e (Playwright), Docker‑конфигурация, CI и автоматические релизы через release-please, деплой на Render (Blueprint). Публичное приложение: [https://booking-service-3k4r.onrender.com](https://booking-service-3k4r.onrender.com). См. [`docs/devlog/0001-frontend-impl.md`](docs/devlog/0001-frontend-impl.md), [`docs/devlog/0006-ci-and-release-please.md`](docs/devlog/0006-ci-and-release-please.md) и [`docs/devlog/0010-render-deploy.md`](docs/devlog/0010-render-deploy.md).
