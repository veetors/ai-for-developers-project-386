# AGENTS.md

Контекст репозитория для агентов OpenCode. Дополняет `README.md` и девлоги в `docs/devlog/`.

## Структура репозитория

Три независимых пакета, у каждого свои зависимости — общего install в корне нет.

- `spec/` — контракт TypeSpec, источник правды. `npm install` + `npm run compile`.
- `frontend/` — SPA на React 18 + Vite 5 + TanStack Query + shadcn/ui. `npm install`.
- `backend/` — Django 6 + django-ninja + pydantic v2, Poetry, Python 3.14. `poetry install`.
- Корневой `package.json` — **только husky/commitlint** (без app-кода, без `type: module`). `npm install` в корне лишь ставит commit-хук.
- Команды фронта запускай из `frontend/`, команды бэка — из `backend/`. Из корня репозитория ничего app-ориентированного не запускается.

## Поток контракт → кодогенерация (важен порядок)

`spec/api.tsp` — источник правды, всё остальное генерируется из него.

1. Редактируешь `spec/api.tsp`.
2. `cd spec && npm run compile` → перегенерирует `spec/generated/openapi.yaml` (этот файл ЗАКОММИЧЕН).
3. `cd frontend && npm run gen:api` → перегенерирует `frontend/src/api/generated/schema.d.ts` (в `.gitignore`, НЕ коммитится).
4. Опциональная smoke-проверка: `npm run mock:contract` (поднимает Prism, дёргает `GET /api/event-types`).

Сгенерированный TS-схемы в git нет. На свежем чекауте `npm run typecheck` упадёт, пока не отработает `gen:api`. `npm run build` сам запускает `gen:api`; `npm run typecheck` — **нет**, на чистом дереве сначала выполни `npm run gen:api`.

## Frontend (`frontend/`)

### Команды
- `npm run dev` — Vite на :5173, проксирует `/api` на `API_PROXY_TARGET` (по умолчанию Prism :4010). Для ручной отладки против бэкенда: `API_PROXY_TARGET=http://localhost:8000 npm run dev`.
- `npm run test:unit` / `:watch`. Один тест: `npx vitest run tests/unit/slots.spec.ts` или `-t "name"`.
- `npm run test:e2e` — Playwright acceptance против реального backend. **Сначала нужен `npm run build`**: webServer поднимает `docker compose --profile default up -d --build --wait backend frontend db`; фронтенд доступен на `http://localhost:3000` (nginx в контейнере `frontend` проксирует `/api` на `backend:8000` внутри сети). `globalSetup` делает полный reset (`down -v` перед `up`) и проверяет готовность через `http://localhost:3000/api/event-types`. Тесты используют `request` и `page.goto('/...')` без `page.route()` — все запросы идут через цепочку `Browser → localhost:3000 (nginx) → backend:8000`. Один тест: `npx playwright test tests/acceptance/US-G5-public-happy-path.spec.ts` или `-g "name"`.
- `npm run mock:contract` — ручная smoke-проверка контракта OpenAPI (поднимает Prism, дёргает `GET /api/event-types`); для CI не нужна.
- `npm run lint` / `format` (prettier) / `typecheck` (`tsc -b --noEmit`).

### Порядок проверок
`gen:api` (на чистом дереве) → `lint` → `typecheck` → `test:unit` → `build` → `test:e2e`.

### Конвенции
- Весь HTTP — через `src/api/client.ts` (openapi-fetch); не-2xx → `AppError(status, ErrorBody)`. Не вызывай `fetch` напрямую.
- Клиент создаётся с `baseUrl: ''` — передавай полные пути вида `/api/event-types`. **Не** задавай baseUrl и **не** дублируй префикс `/api`.
- Маппинг `ErrorCode → русский текст` — в `src/api/errors.ts`; формат ошибки `{ error: { code, message, details? } }`.
- Вся логика «сегодня»/«окно 14 дней» — через `date-fns-tz` с `Europe/Moscow` (МСК). Не используй локальное/серверное время.
- Псевдоним пути `@/` → `src/`.
- shadcn/ui — **локальная копия** в `src/components/ui/` (style `new-york`). Добавляй компоненты через shadcn MCP (настроен в `opencode.json`); не импортируй shadcn из npm-пакета.
- Никаких глобальных state-менеджеров сверх TanStack Query + React Context.
- `duration_minutes` в v1 зафиксировано = `30` (zod `z.literal(30)`); в админ-форме readonly.
- Prettier: без точек с запятой, одинарные кавычки, trailing comma `all`, ширина 100, отступ 2 пробела.
- `src/api/generated/**` под eslint-ignored — не линть и не правь сгенерированную схему вручную.

## Backend (`backend/`)

### Установка и команды (запуск из `backend/`)
- Нужен Python 3.14 (`.envrc` использует direnv + pyenv 3.14.6). `poetry install`.
- `poetry run pytest` — тесты в `booking/tests` (`pytest.ini` задаёт `DJANGO_SETTINGS_MODULE=config.settings`). Один тест: `poetry run pytest booking/tests/test_slot_grid.py` или `-k "name"`.
- `poetry run ruff check .` / `poetry run ruff format .` — запуск из `backend/`. (`backend/README.md` показывает `poetry run ruff check backend` — это работает только из корня репозитория, где у Poetry нет проекта; используй `cd backend && poetry run ruff check .`.)
- Dev: `poetry run uvicorn config.asgi:application --reload --port 8000`. Prod (как в Docker): `gunicorn config.wsgi:application`.

### Архитектура
- Точка входа `config/urls.py`: одна `NinjaAPI`, два роутера (`/api/event-types` public, `/api/owner` owner). Глобальные обработчики приводят все ошибки (вкл. `ninja.errors.ValidationError`) к `{ error: { code, message, details } }`.
- Хранилище **in-memory** (репозитории — словари под одним `threading.Lock`); рестарт процесса = данные стёрты. `DATABASES` — sqlite `:memory:`, репозиториями не используется.
- Слои: `domain.py` (`@dataclass(frozen=True)`) + `Protocol`-репозитории → `services/` (бизнес-правила) → `api/` (pydantic v2-схемы + django-ninja роутеры). Pydantic — только в API-слое.
- Clock DI: сервисы принимают `Callable[[], datetime]` (по умолчанию `booking.timeutils.now_utc`). В тестах время фиксируется фикстурой `frozen_clock` (monkeypatch `booking.timeutils.now_utc`) — **без `freezegun`**.
- Фикстура `reset_repos` — `autouse=True` (`app_registry.reset()`); каждый тест стартует с чистого состояния.
- Серверные правила: окно 14 дней МСК, часы 06:00–22:00 МСК, сетка 30 мин (32 слота), конфликт слотов атомарно проверяется под локом в `InMemoryBookingRepo.reserve()`.
- `booking/errors.py:ErrorCode` должен совпадать с `frontend/src/api/types.ts:ErrorCode` — это один и тот же wire-контракт.

## Git и CI
- Conventional Commits проверяются **локально** хуком husky `commit-msg` + commitlint (`@commitlint/config-conventional`). Типичные scope: `frontend`, `backend`. Merge-коммиты пропускаются. В CI не проверяется.
- `.github/workflows/hexlet-check.yml` автогенерируется Hexlet — **не редактировать и не удалять**.
- `.opencode/` и `opencode.json` в `.gitignore` (локальный конфиг OpenCode); `opencode.json` сейчас включает shadcn MCP.

## Docker
Два compose-профиля — `docker compose up` без профиля не поднимает ничего.
- `docker compose --profile frontend-only up` — frontend (:3000→8080, nginx проксирует `/api` на Prism) + Prism (:4010). Без бэкенда. Полезно для ручной проверки SPA без своего Django.
- `docker compose --profile default up` — frontend (:3000, nginx) + backend (:8000 внутри сети) + postgres:16. nginx проксирует `/api` на `backend:8000`. Этот же backend используется в `npm run test:e2e` (см. раздел Frontend).

## Переменные окружения, влияющие на dev-флоу
- `VITE_API_BASE_URL` (по умолчанию `/api`).
- `API_PROXY_TARGET` — куда Vite-прокси шлёт `/api`; по умолчанию `http://localhost:4010` (Prism, используется `frontend-only` compose-профиль). Для полного стека локально без Docker укажи реальный бэкенд (напр. `http://localhost:8000`). Acceptance-тесты поднимают свой backend через docker compose (см. раздел Frontend), эта переменная для них не используется.
