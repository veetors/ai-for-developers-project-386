# Архитектура фронтенда «Запись на звонок»

> Этап проектирования фронтенда v1. Основано на PRD (`spec/01-pdr.md`), API‑контракте (`spec/api.tsp`) и генераторе OpenAPI (`spec/tspconfig.yaml`). Документ задаёт границу между фронтендом и бэкендом и описывает реализацию в рамках подхода Design First.

---

## 1. Контекст и принципы

- Фронтенд — отдельное приложение со своим репозиторием каталогов, своим образом в Docker и своим развёртыванием.
- Фронтенд получает данные и выполняет действия **только через API по контракту**, описанному в `spec/api.tsp` и сгенерированному в `spec/generated/openapi.yaml`.
- Front‑код работает корректно как против реального бэкенда (Django), так и против мока (Prism), без условных веток в коде — разница только в upstream на уровне Vite‑proxy или nginx.
- В v1 нет авторизации, личных кабинетов и внешних интеграций — архитектура этих возможностей не закладывает.
- Разделение доступа между публичной и админ‑частями инфраструктурное: разные URL‑префиксы `/api/event-types/*` и `/api/owner/*`, разные SPA‑роуты, опционально разные точки входа через reverse‑proxy.

---

## 2. Технологический стек

| Слой | Технология | Где |
|---|---|---|
| Bundler / dev‑server | Vite 5 | `frontend/` |
| Язык | TypeScript (strict) | весь фронт |
| UI | React 18 | `frontend/src/` |
| Стили | Tailwind CSS 3 | `tailwind.config.ts`, `postcss.config.js` |
| Компоненты | shadcn/ui (копия в репо) | `src/components/ui/` |
| Маршрутизация | React Router 6 | `src/app/router.tsx` |
| Серверное состояние | TanStack Query 5 | `src/app/query-client.ts` |
| HTTP‑транспорт | openapi‑fetch | `src/api/client.ts` |
| Типы API | openapi‑typescript | `src/api/generated/schema.d.ts` |
| Формы | react‑hook‑form + zod | `src/features/**/BookingDraft*.tsx`, `*Form.tsx` |
| Дата/время | `Intl.DateTimeFormat` + `date-fns-tz` (только MSK) | `src/api/time.ts`, `src/lib/formatters.ts` |
| Мок API | Stoplight Prism CLI | dev‑режим, ручной smoke |
| Юнит‑тесты | Vitest + @testing-library/react | `tests/unit/` |
| E2E | Playwright | `tests/acceptance/` (против реального Django через docker compose) |
| Линт/формат | ESLint (typescript-eslint), Prettier | корень |
| Контейнеризация | compose-профили + корневой multi-stage `Dockerfile` | `Dockerfile.frontend`, `frontend/nginx.conf`, корневой `Dockerfile`/`nginx.conf.template`/`docker-entrypoint.sh` |

Дополнительных зависимостей сверх списка не вводится.

---

## 3. Сетевые режимы

| Режим | Сервисы | Upstream для `/api` |
|---|---|---|
| **A. Frontend‑only dev** | Vite + Prism | Vite proxy → `http://localhost:4010` |
| **B. Playwright acceptance** | real stack (`docker compose --profile default`) | nginx внутри `frontend` → `http://backend:8000` |
| **C. Полный стек (compose)** | `frontend` + `backend` + `db` | nginx внутри `frontend` → `http://backend:8000` |
| **D. Продакшен‑образ** | nginx + Django в одном контейнере | nginx → unix‑сокет API (`/tmp/booking-api.sock`) |

`VITE_API_BASE_URL=/api` всегда — конкретный upstream выбирает proxy. В коде клиента нет условных веток «real/mock».

### Профили docker compose

- `default`: `frontend`, `backend`, `db` — полный стек.
- `frontend-only`: `frontend`, `prism` — разработка без бэкенда по контракту.

Переключение:
```bash
docker compose --profile default up     # полный стек
docker compose --profile frontend-only up   # только фронт + мок
```

---

## 4. Структура проекта `frontend/`

```
frontend/
├── nginx.conf                    # /api proxy_pass backend:8000 (compose)
├── nginx.prism.conf              # proxy_pass prism:4010 (профиль frontend-only)
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json               # shadcn/ui config
├── vitest.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/globals.css
│   ├── app/
│   │   ├── router.tsx
│   │   ├── query-client.ts
│   │   ├── error-boundary.tsx
│   │   └── providers.tsx        # QueryClientProvider + Toaster
│   ├── api/
│   │   ├── client.ts            # openapi-fetch + baseURL + interceptor → AppError
│   │   ├── errors.ts            # ErrorCode → AppError + i18n
│   │   ├── time.ts              # UTC ↔ MSK, форматирование
│   │   ├── types.ts             # alias из generated
│   │   └── generated/           # генерируется скриптом gen:api
│   │       ├── schema.d.ts
│   │       └── README.md
│   ├── lib/
│   │   ├── cn.ts                # clsx + tailwind-merge
│   │   └── formatters.ts        # ru-RU, Europe/Moscow
│   ├── components/
│   │   ├── ui/                  # shadcn (Button, Card, Calendar, Dialog, …)
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx
│   │   │   └── AppFooter.tsx
│   │   └── shared/
│   │       ├── ErrorMessage.tsx
│   │       ├── EmptyState.tsx
│   │       └── LoadingSpinner.tsx
│   ├── pages/
│   │   ├── public/
│   │   │   ├── HomePage.tsx
│   │   │   ├── EventTypesPage.tsx
│   │   │   ├── EventTypeSlotsPage.tsx
│   │   │   ├── BookingFormPage.tsx
│   │   │   └── BookingSuccessPage.tsx
│   │   └── admin/
│   │       ├── AdminBookingsPage.tsx
│   │       ├── AdminEventTypesPage.tsx
│   │       ├── AdminEventTypeNewPage.tsx
│   │       └── AdminEventTypeEditPage.tsx
│   └── features/
│       ├── public-catalog/
│       │   ├── useEventTypes.ts
│       │   └── EventTypeCard.tsx
│       ├── public-slot-picker/
│       │   ├── useSlots.ts
│       │   ├── SlotGrid.tsx
│       │   └── Calendar14.tsx
│       ├── public-booking/
│       │   ├── useCreateBooking.ts
│       │   ├── BookingDraftContext.tsx
│       │   └── ContactForm.tsx
│       ├── admin-event-types/
│       │   ├── useAdminEventTypes.ts
│       │   ├── useAdminEventType.ts
│       │   ├── useCreateEventType.ts
│       │   ├── useUpdateEventType.ts
│       │   ├── useDeleteEventType.ts
│       │   └── EventTypeForm.tsx
│       └── admin-bookings/
│           ├── useAdminBookings.ts
│           └── UpcomingBookingsTable.tsx
└── tests/
    ├── e2e/
    │   ├── public-booking.spec.ts
    │   ├── public-slot-conflict.spec.ts
    │   ├── admin-event-types.spec.ts
    │   └── admin-bookings.spec.ts
    └── unit/
        ├── slots.spec.ts
        ├── time-msk.spec.ts
        ├── errors-mapping.spec.ts
        └── event-type-form.spec.ts
```

Принципы:
- `pages/` — только композиция; не содержит логики запросов/форм.
- `features/` — вертикальные фичи: данные + UI конкретной задачи.
- `api/` + `lib/` — горизонтальные инфраструктурные слои.
- `components/ui/` — копия shadcn/ui в репо, без npm‑импорта.
- `BookingDraftContext` хранит выбранную «тройку» (eventTypeId, YYYY-MM-DD, start_at) только на время одного сценария бронирования.

---

## 5. API‑слой

### 5.1. Генерация

`package.json`:
```json
{
  "scripts": {
    "gen:api": "openapi-typescript ../spec/generated/openapi.yaml -o src/api/generated/schema.d.ts",
    "build": "npm run gen:api && tsc -b && vite build"
  }
}
```

`openapi-typescript` собирает **те же типы**, что отдаёт Django и что эмулирует Prism. Это значит, что любое расхождение контракта и фронта ловится на этапе компиляции TypeScript, до запуска кода и до прогонов e2e.

### 5.2. Клиент (`src/api/client.ts`)

- Базовый URL: `import.meta.env.VITE_API_BASE_URL` (по умолчанию `/api`).
- `openapiFetch` плюс один `afterResponse` интерсептор: на не‑2xx выбрасываем `AppError(status, ErrorBody)`.
- Таймаут через `AbortSignal.timeout(15_000)` по умолчанию; в рамках одной мутации допускается передать внешний `AbortController`.

### 5.3. Ошибки (`src/api/errors.ts`)

Маппинг `ErrorCode → русское сообщение`:

| `code` | Сообщение для UI |
|---|---|
| `validation_failed` | список `details[].messages` по полям формы |
| `slot_outside_window` | «Выбранная дата вне доступного окна (14 дней).» |
| `slot_outside_hours` | «Время вне рабочего диапазона 06:00–22:00 МСК.» |
| `slot_in_past` | «Это время уже прошло.» |
| `slot_taken` | «Слот только что заняли. Выберите другое время.» |
| `event_type_not_found` | «Тип события не найден.» |
| `booking_not_found` | «Бронирование не найдено.» |
| `invalid_duration` | «Длительность должна быть 30 минут.» |
| `internal_error` | «Внутренняя ошибка сервера.» |

`toFieldErrors(error: AppError)` нормализует `details[].field` → структура ошибок `react-hook-form`.

### 5.4. Время (`src/api/time.ts`, `src/lib/formatters.ts`)

Все моменты от сервера приходят как `offsetDateTime` (UTC ISO 8601 с offset). Дополнительных манипуляций с TZ не требуется: `new Date(iso)` создаёт корректный момент. Отображение — через `Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', … })`, без клиентских библиотек расчёта TZ, кроме `date-fns-tz` для арифметики по дням (`addDays(todayInMsk(), 13)`).

Все производные от «сегодня» и «границы 14‑дневного окна» **обязаны** использовать `timeZone: 'Europe/Moscow'` — иначе окно поплывёт при клиенте в другой локали.

Хелперы:

- `todayInMsk(): YYYY-MM-DD`
- `addDaysMsk(date, n)`
- `toQueryDate(date)` (для запроса слотов)
- `formatSlotInMsk(iso)` → `09:30 — 10:00`
- `formatAdminBookingTime(iso)` → `31 марта 2026 г., 09:30`

---

## 6. Серверное состояние (TanStack Query)

### 6.1. `QueryClient`

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (count, err) => (err.status < 500 ? false : count < 1),
      refetchOnWindowFocus: true,
    },
  },
});
```

### 6.2. Ключи

```ts
['public', 'event-types']
['public', 'event-type', id]
['public', 'slots', eventTypeId, 'YYYY-MM-DD']
['admin', 'event-types']
['admin', 'event-type', id]
['admin', 'bookings']
```

### 6.3. Хуки

| Хук | Источник | Действия |
|---|---|---|
| `useEventTypes` | `GET /api/event-types` | список для каталога |
| `useEventType(id)` | `GET /api/event-types/:id` | заголовок страницы слотов |
| `useSlots(id, date)` | `GET /api/event-types/:id/slots?date=...` | сетка дня |
| `useCreateBooking` | `POST /api/event-types/:id/bookings` | `onSuccess` → навигация на `/event-types/:id/success`; `onError(409)` → `invalidate(['public','slots', id, date])` |
| `useAdminEventTypes` | `GET /api/owner/event-types` | таблица |
| `useAdminEventType(id)` | `GET /api/owner/event-types/:id` | форма редактирования |
| `useAdminBookings` | `GET /api/owner/bookings` | таблица |
| `useCreateEventType` / `useUpdateEventType` / `useDeleteEventType` | `POST`/`PUT`/`DELETE` | `invalidate(['admin','event-types', …])`; delete не требует cascade‑инвалидации броней на фронте — сервер хранит `event_type_name`. |

### 6.4. Гонка за слот

`useCreateBooking` на `409 SlotConflictError`:

1. Toast: «Слот только что заняли».
2. `await queryClient.invalidateQueries(['public','slots', id, date])`.
3. `SlotGrid` отдаёт свежий `busy`, кнопка `Продолжить` дисейблится.

Дополнительных websockets / polling в v1 нет — инвалидации после `onError` и `onSuccess` достаточно.

---

## 7. Маршрутизация (React Router 6)

```
/                                HomePage
/event-types                    EventTypesPage
/event-types/:id                EventTypeSlotsPage
/event-types/:id/book           BookingFormPage
/event-types/:id/success        BookingSuccessPage

/admin                          redirect → /admin/bookings
/admin/bookings                 AdminBookingsPage
/admin/event-types              AdminEventTypesPage
/admin/event-types/new          AdminEventTypeNewPage
/admin/event-types/:id          AdminEventTypeEditPage

*                               NotFoundRoute
```

`BookingDraftContext` хранит выбор слота; `BookingConfirmation` после успеха кладётся в `sessionStorage["booking:last"]` и читается на success‑странице.

---

## 8. UI (shadcn/ui) по скриншотам

### 8.1. Public

**`HomePage` (`/`)**
- `Header`: лого «Calendar» + ссылки `Записаться` | `Админка`.
- Левая колонка: `Badge` «БЫСТРАЯ ЗАПИСЬ НА ЗВОНК», `h1` «Calendar», описание, `Button` `Записаться →` (accent).
- Правая колонка: `Card` «Возможности» (3 буллета).
- Маленький `Footer` с теми же логотипом и ссылками.

**`EventTypesPage` (`/event-types`)**
- Card с иконкой владельца, именем, заголовком «Выберите тип события», подзаголовком.
- Грид `Card`-ов: name, description, `Badge` `30 мин`. Вся карточка работает как `<Link>`.

**`EventTypeSlotsPage` (`/event-types/:id`)**
- `grid md:grid-cols-3 gap-6`:
  1. Карточка владельца + тип события + read‑only поля «Выбранная дата», «Выбранное время».
  2. `Calendar` из shadcn в режиме `single`, стрелки `<` / `>`. Все даты вне окна «сегодня..сегодня+13» дизейблятся.
  3. `Card` «Статус слотов»: список интервалов с `Badge` `Свободно`/`Занято`. Выбранный — `ring-primary`.
- Кнопки `Назад` (ghost) и `Продолжить` (primary, disabled, пока слот не выбран).

**`BookingFormPage` (`/event-types/:id/book`)**
- Сводка (тип + дата + `formatSlotInMsk(slot)`).
- `react-hook-form` + zod: name 1–200, email.
- `Button` `Подтвердить бронирование`.

**`BookingSuccessPage` (`/event-types/:id/success`)**
- `Card` со всеми полями `BookingConfirmation` в МСК (дата, время, тип события, гость, email, идентификатор брони).
- Кнопка `Записаться ещё` → `/event-types`.

### 8.2. Admin

**`AdminBookingsPage` (`/admin/bookings`)**
- `Table`: дата/время (МСК), тип события (имя), гость, email.

**`AdminEventTypesPage` (`/admin/event-types`)**
- `Table` + `Button` `Создать тип`.
- Действия в строке: `Редактировать`, `Удалить`.
- Удаление через `AlertDialog` с подтверждением.

**`AdminEventTypeNewPage` / `EditPage`**
- `name` (required, 1–200), `description`, `duration_minutes` (readonly=30, подпись «В v1 длительность фиксирована — 30 минут.»).
- `Submit` → `useCreateEventType` / `useUpdateEventType`.
- На 422 `invalid_duration` — toast.

---

## 9. Vite / Docker / Compose

### 9.1. `vite.config.ts`

- alias `@/` → `src/`.
- `server.host = true`.
- `server.proxy['/api']`:
  - если задан `process.env.API_PROXY_TARGET` — проксирует туда;
  - иначе — `http://localhost:4010` (Prism, режим A по умолчанию).
- Запуск Dev: `vite` читает `.env.development` (`VITE_API_BASE_URL=/api`).

### 9.2. `Dockerfile.frontend` (образ фронта для compose)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY spec/generated/openapi.yaml ./contract/openapi.yaml
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npx openapi-typescript ./contract/openapi.yaml -o src/api/generated/schema.d.ts \
    && npx tsc -b \
    && npx vite build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
```

`frontend/nginx.conf`:
- `try_files $uri /index.html` для SPA fallback.
- `location /api/ { proxy_pass http://backend:8000; }` для compose.

Опциональный `frontend/nginx.prism.conf` подключается в профиле `frontend-only` (`proxy_pass http://prism:4010;`).

### 9.3. `docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        VITE_API_BASE_URL: /api
    profiles: [default]
    ports: ["3000:8080"]
    depends_on: [backend]

  backend:
    build:
      context: ./backend
    profiles: [default]

  db:
    image: postgres:16-alpine
    profiles: [default]

  prism:
    image: stoplight/prism:4
    command: ["mock", "/contracts/openapi.yaml", "--port", "4010", "--host", "0.0.0.0"]
    volumes:
      - ./spec/generated/openapi.yaml:/contracts/openapi.yaml:ro
    profiles: ["frontend-only"]
```

Запуск:
- `docker compose --profile default up` — full stack.
- `docker compose --profile frontend-only up` — фронт + мок.

Отдельно от compose — корневой multi-stage `Dockerfile` (продакшен‑образ: nginx +
SPA + Django в одном контейнере, порт `$PORT`, `/api` и `/healthz` через nginx на
unix‑сокет `/tmp/booking-api.sock`): `docker build -t booking-service .` →
`docker run --rm -p 8080:8080 -e PORT=8080 booking-service`.

### 9.4. Ручной dev вне Docker

- `cd spec && npm run compile` (генерация `openapi.yaml`).
- `npx -y @stoplight/prism-cli mock ../spec/generated/openapi.yaml --port 4010 --dynamic` — Prism на `4010`.
- В другом терминале `cd frontend && npm run dev` — Vite на `5173`, прокси `/api` → `4010`.

Если поднят реальный Django:
- `API_PROXY_TARGET=http://localhost:8000 npm run dev`.

---

## 10. Playwright и acceptance‑тесты

### 10.1. Архитектура тестов

`playwright.config.ts`:
- `testDir` — `tests/acceptance/`.
- `webServer` — `docker compose --profile default up -d --build --wait backend frontend db`; фронт доступен на `http://localhost:3000` (nginx проксирует `/api` на `backend:8000` внутри сети compose).
- `globalSetup` — полный reset стека (`down -v` перед `up`) и проверка готовности через `http://localhost:3000/api/event-types`.
- Тесты используют `request` и `page.goto('/...')` без `page.route()` — все запросы идут по цепочке `Browser → localhost:3000 (nginx) → backend:8000`.

### 10.2. Сценарии

| ID | Файл | Сценарий |
|---|---|---|
| G1 | `US-G1-home-to-catalog.spec.ts` | home → каталог типов событий. |
| G4 | `US-G4-out-of-window-calendar.spec.ts` | Выбор даты за пределами окна 14 дней — недоступно; календарь ограничивает диапазон. |
| G5 | `US-G5-public-happy-path.spec.ts` | Создание брони: каталог → тип → слот → форма → успех; проверка подтверждения в МСК. |
| G6 | `US-G6-slot-conflict-409.spec.ts` | Два клиента на одной дате/слоте: второй получает `409` → после рефетча слот `busy`. |
| G7 | `US-G7-public-validation.spec.ts` | Валидация контактов/длительности в публичной форме. |
| INT1 | `US-INT1-full-flow.spec.ts` | Сквозной флоу гость + админ. |
| O1 | `US-O1-admin-bookings-list.spec.ts` | Список будущих броней админа с корректным МСК‑временем. |
| O2 | `US-O2-admin-create-event-type.spec.ts` | Создание типа события админом. |
| O3 | `US-O3-admin-edit-delete.spec.ts` | Редактирование и удаление через `AlertDialog`; после удаления запись исчезает из каталога. |
| O4 | `US-O4-admin-bookings-after-delete.spec.ts` | Поведение броней после удаления типа события. |

Состояние «занят» хранится в in‑memory репозитории реального Django: для
воспроизводимости конфликта (G6) тест делает POST, затем GET в одном тесте.
После тестов стек сбрасывается `docker compose down -v` (рестарт = пустое
хранилище).

---

## 11. Точки риска

1. **TZ браузера vs МСК.** Все «сегодня» и «окно 14 дней» только через `Intl` с `timeZone: 'Europe/Moscow'`. Запрещено использовать `new Date()` и `Date.now()` как момент «сейчас» в бизнес‑логике.
2. **Гонка за слот.** Решается атомарной проверкой на сервере плюс `invalidate(['public','slots', id, date])` на фронте после 409. Никаких оптимистичных апдейтов у фронта — статус идёт только от сервера.
3. **Детерминизм acceptance‑тестов.** Каждый прогон стартует с чистого состояния (`globalSetup` делает `down -v` перед `up`), занятость создаётся в самом тесте (G6). Тесты не параллелятся (`workers: 1`).
4. **`sessionStorage["booking:last"]`.** Хранит `BookingConfirmation` только пока пользователь идёт по success‑странице. На F5 без возврата — нет отдельного эндпоинта «посмотреть бронь» в v1, поведение принимается.
5. **`@openapi` ↔ код.** Любое изменение `spec/api.tsp` → перегенерация `schema.d.ts` → проверка компиляции → опционально ручной smoke `npm run mock:contract`.
6. **`duration_minutes` в форме админа.** Поле readonly со значением `30`. Если в v2 потребуются варианты — расширяется только после соответствующего изменения бэкенда и `api.tsp`.

---

## 12. План реализации

1. Инициализация Vite + React + TS + Tailwind + shadcn init.
2. Скрипты `gen:api`, `mock:contract`; первый проход `npm run gen:api`.
3. API‑слой: `client.ts`, `errors.ts`, `time.ts`, `formatters.ts`. Smoke‑вызовы против mock‑Prism.
4. `QueryClient`, base‑хуки (`useEventTypes`, `useAdminEventTypes`).
5. Public pages: Home → Catalog → Slot picker → Form → Success.
6. Admin pages: Bookings → EventTypes CRUD.
7. Dockerfile + nginx.conf + compose‑профили.
8. Playwright acceptance против реального backend (docker compose); прогон e2e.
9. Линт/билд финальный проход; фиксация `npm run preview` + `npm run mock:contract` как основных команд для запуска без Docker.

Чек‑лист перед «готов к деплою»:
- [ ] `npm run build` собирается чисто (без TS‑ошибок и ESLint warnings).
- [ ] `npm run test:unit` зелёный.
- [ ] `npm run test:e2e` против реального backend зелёный.
- [ ] `docker compose --profile default up` стартует весь стек (frontend, backend, db) end‑to‑end.
- [ ] `docker compose --profile frontend-only up` стартует frontend + Prism и позволяет пройти основной сценарий гостя и админа.

---

## 13. Открытые вопросы / последующие улучшения

- **`@example` в `api.tsp`.** Для красивых карточек и слотов в режиме A (Prism без бэкенда) желательно добавить `@example` для `EventType` и `Slot` (например, «Встреча 30 минут», 2–3 слота с разными статусами). Это косметика контракта, в текущей редакции `api.tsp` отсутствует. Можно отложить отдельной задачей.
- ~~**E2E acceptance против реального Django.**~~ ✅ Реализовано: `tests/acceptance/` против реального стека (`docker compose --profile default`), см. раздел 10.

---

## 14. Соответствие требованиям задания

- ✅ Фронтенд — отдельная часть приложения (отдельный сервис в compose, отдельный код).
- ✅ Все данные/действия — через API по контракту; код опирается только на типы из `openapi.yaml`.
- ✅ Интерфейс работает с отдельно запущенным бэкендом (`npm run dev` + локальный Django; Vite‑proxy на `localhost:8000`).
- ✅ Без избыточной микросервисности: один SPA, TanStack Query + openapi‑fetch, без стейт‑менеджера сверх необходимого.
- ✅ Без авторизации в v1; разделение public/admin через URL‑префиксы API и роуты SPA.
- ✅ Соответствие скриншотам‑примерам в `spec/screenshots_examples/`.
- ✅ Таймзона `Europe/Moscow` для пользователя, UTC ISO 8601 для обмена.
