# Реализация фронтенда «Запись на звонок»

## 🎯 Проблема
Подготовить фронтенд для проекта «Запись на звонок» по архитектурному документу `spec/02-frontend-architecture.md`: SPA на Vite/React/TanStack Query, код строго по контракту `spec/api.tsp`, поддержка мок-режима Prism, проверка e2e и docker-compose профилей.

## ✅ Решение
Поднята полная SPA в каталоге `frontend/` согласно спецификации:
- Vite 5 + React 18 + TypeScript strict + Tailwind 3 + shadcn/ui (копия компонентов в `src/components/ui/`);
- API‑слой: openapi‑fetch с interceptor → `AppError(status, ErrorBody)`, маппинг `ErrorCode → русский текст`, хелперы `todayInMsk/addDaysMsk/formatSlotRangeInMsk` на `date-fns-tz`;
- Серверное состояние: TanStack Query v5 с ключами строго по разделу 6.2 спеки; гонка за слот обрабатывается через `invalidate(['public','slots', id, date])` после `onError(409)`;
- Публичный сценарий: Home → Catalog → Slot picker (3 колонки, Календарь на 14 дней) → Booking form → Success;
- Админский сценарий: Bookings table, Event Types CRUD c `AlertDialog` подтверждением удаления;
- Сгенерирован OpenAPI → TypeScript код (`src/api/generated/schema.d.ts`) скриптом `npm run gen:api`;
- Добавлены `@example` в `spec/api.tsp` для EventType (slot/Bootstrapping);
- Тесты: Vitest (20 unit‑тестов) + Playwright (5 e2e) против моков через `page.route`;
- Dockerfile multi‑stage + nginx.conf (SPA fallback, proxy на backend) + nginx.prism.conf (frontend‑only profile);
- docker-compose с двумя профилями: `default` (frontend + backend + db) и `frontend-only` (frontend + prism).

## 📝 Изменённые файлы

### Spec / контракт
1. `spec/api.tsp` — добавлены `@example` для моделей `EventType` (без `offsetDateTime`).
2. `spec/generated/openapi.yaml` — перегенерирован.

### Frontend (новые файлы)
3. `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig*.json`, `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/components.json`, `frontend/eslint.config.js`, `.prettierrc`, `.env.*`.
4. `frontend/src/api/{client,errors,time,types}.ts`, `frontend/src/api/generated/schema.d.ts`.
5. `frontend/src/lib/{utils,formatters}.ts`.
6. `frontend/src/app/{providers,query-client,error-boundary}.tsx`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles/globals.css`.
7. `frontend/src/components/ui/{button,card,dialog,alert-dialog,table,badge,input,label,separator,calendar,skeleton,toaster}.tsx`.
8. `frontend/src/components/layout/{AppHeader,AppFooter}.tsx`, `shared/{LoadingSpinner,EmptyState,ErrorMessage}.tsx`.
9. `frontend/src/features/public-catalog/{useEventTypes,EventTypeCard}.tsx`, `features/public-slot-picker/{useSlots,Calendar14,SlotGrid}.tsx`, `features/public-booking/{useCreateBooking,BookingDraftContext,ContactForm}.tsx`.
10. `frontend/src/features/admin-event-types/{useAdminEventTypes,useAdminEventType,useCreateEventType,useUpdateEventType,useDeleteEventType,EventTypeForm}.tsx`.
11. `frontend/src/features/admin-bookings/{useAdminBookings,UpcomingBookingsTable}.tsx`.
12. `frontend/src/pages/public/{HomePage,EventTypesPage,EventTypeSlotsPage,BookingFormPage,BookingSuccessPage,NotFoundRoute}.tsx`, `pages/admin/{AdminBookingsPage,AdminEventTypesPage,AdminEventTypeNewPage,AdminEventTypeEditPage}.tsx`.
13. `frontend/tests/unit/{slots,time-msk,errors-mapping,event-type-form}.spec.ts`.
14. `frontend/tests/e2e/{global-setup.ts,public-booking,public-slot-conflict,public-slot-out-of-window,admin-event-types,admin-bookings}.spec.ts`.
15. `frontend/Dockerfile`, `dockerignore`, `nginx.conf`, `nginx.prism.conf`.

### Корень
16. `docker-compose.yml` (два профиля), `.dockerignore`.
17. `README.md` (раздел «Запуск»), `docs/devlog/0001-frontend-impl.md` — этот файл.

## 🚀 Как протестировать

### Локально без Docker

```bash
cd spec && npm install && npm run compile       # 1. Сгенерировать openapi.yaml
cd ../frontend && npm install                    # 2. Зависимости
npm run dev                                       # 3. Vite dev на :5173, прокси /api → :4010 (Prism)
# в другом терминале:
npm run mock                                      # 4. Prism на :4010 с контрактом
```

Проверки:

```bash
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint
npm run test:unit    # vitest (20 тестов: slots/time-msk/errors/event-type-form)
npm run build        # production-сборка + gen:api
npm run preview &    # vite preview на :4173
npm run test:e2e     # Playwright (5 e2e через page.route — Prism/сеть не нужны)
```

### Docker Compose

```bash
# Полный фронт + мок‑API (Prism) — без бэкенда:
docker compose --profile frontend-only up

# Полный стек (после реализации backend на ветке 03‑backend):
docker compose --profile default up
```

## ⚙️ Важные детали

- **TZ — только MSK.** Все границы 14‑дневного окна считаются через `date-fns-tz` + `formatInTimeZone(date, MSK, ...)`. Юнит‑тест `time-msk.spec.ts` фиксирует поведение на границе полуночи MSK с подменой `vi.setSystemTime`.
- **Структура ошибок API.** Контракт для 4xx/5xx‑ответов: `{ error: { code, message, details? } }`. `client.ts` распаковывает обёртку (`unwrapErrorBody`) перед бросанием `AppError`, чтобы проверки `error.body.code === 'slot_taken'` не уходили в fallback.
- **Базовый URL openapi‑fetch.** `baseUrl: ''` — пути клиента передаются полностью (`/api/event-types/...`). Это совпадает с типами openapi‑typescript без дублирования префикса.
- **409 гонка за слот.** `useCreateBooking.onError(409)`: toast «Слот только что заняли.» + `invalidate(['public','slots', id, date])`. UI повторно рендерит сетку с обновлённым статусом — кнопка `Продолжить` дисейблится, если выбранный слот стал `busy`. Тест `public-slot-conflict.spec.ts` подтверждает это поведение.
- **`sessionStorage['booking:last']`.** Хранит `BookingConfirmation` между `/book` и `/success`; при F5 success‑страница показывает сообщение «Бронирование не найдено» — приемлемо для v1 (отдельный эндпоинт «посмотреть бронь» не предусмотрен).
- **`duration_minutes` в админ‑форме** — readonly `30` в v1; zod проверяет `duration_minutes: z.literal(30)` (в юнит‑тесте).
- **shadcn/ui: components.json + копия в `src/components/ui/`.** Зависимости только из списка спеки (radix‑suite, class‑variance‑authority, lucide‑react, sonner). Не добавлено ничего сверх списка.
- **E2E архитектура.** Playwright поднимает `vite preview` (тот же билд, что и в Docker) на :4173. Тесты мокают API через `page.route()` — это даёт детерминизм без зависимости от конкретных Prism‑флагов. Глобальный setup Prism оставлен, чтобы быстро выполнять ручные «ручные» проверки контракта против реального мока.

## 🎉 Итог

Фронтенд собран по архитектурному документу, проходит TS‑чек, ESLint, 20/20 unit и 5/5 e2e тестов. SPA умеет работать и под полный стек (nginx‑proxy на backend), и под frontend‑only профиль (nginx‑proxy на Prism). Полная инструкция запуска в README.
