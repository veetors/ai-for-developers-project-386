# Пользовательские сценарии «Запись на звонок»

> Каталог сценариев, по которым проверяется связка `frontend ↔ backend` на уровне пользовательских путей. Сценарии выписаны из `spec/01-pdr.md` (§121–128 публичный путь, §36–40 владелец), API-контракта `spec/api.tsp` и существующих UI/backend тестов.

## 🎯 Проблема

До этого шага проверки шли изолированно:

- Backend — pytest через `ninja.testing.TestClient`, in-memory данные.
- Frontend — Playwright e2e с `page.route()` моками против Prism.

Эти слои **никогда не встречались в одном прогоне**: реальный Django процесс не получал запрос от собранного `frontend/dist`, и мы не знали, проходит ли ключевой путь бронирования `home → каталог → слот → форма → success → admin/booking` действительно end-to-end.

Нужен был явный «каталог пользовательских сценариев» + acceptance-тесты, которые:
1. Поднимают реальный Django (через `docker compose`) и собранный `frontend/dist` (`vite preview`).
2. Не подменяют API через `page.route()`.
3. Прогоняются локально одной командой; не зависят от CI (CI не запускает Playwright — `AGENTS.md` §Git и CI).
4. Идемпотентны: каждый прогон стартует backend в чистом состоянии.

## ✅ Решение

Создан единый канонический набор **acceptance-сценариев** на уровне пользовательских путей. Все шаги проходят против реального Django (`docker compose backend db`) через собранный `frontend/dist` (`vite preview`). Моки убраны — каждый сценарий подтверждается на реальной связке frontend↔backend.

Ключевые решения:

- **Один `playwright.config.ts`** под acceptance: `testDir = ./tests/acceptance`, единственный webServer-стек `[compose backend+db, vite preview :4174]`, один `globalSetup` (compose down-v + up --wait + polling `/api/event-types`).
- **Канал**: `vite preview :4174` → `/api` → прокси Vite → `:8000` (Django в compose). `API_PROXY_TARGET=http://localhost:8000` пробрасывается через `webServer.env`. Vite-proxy работает в `preview`-режиме (`vite.config.ts:preview.proxy`), nginx при этом не задействован.
- **Compose-only services**: `docker compose --profile default up -d --build --wait backend db`. Контейнер `frontend` (`:3000`) НЕ стартует — чтобы не дублировать фронт и не конкурировать за порт.
- **Полный reset перед прогоном**: `globalSetup` делает `docker compose --profile default down -v && up --wait`. `--wait` + healthcheck `GET /api/event-types` на бэкенде гарантируют готовность. Teardown — тот же `down -v`.
- **Никаких `page.route()`, никаких параллельных mock-наборов**. `@stoplight/prism-cli` удалён из devDependencies: реальный backend проверяется ровно один раз, через один набор тестов.
- **Без правки contract / backend / frontend-кода кроме `playwright.config.ts`, `package.json` и самих acceptance-файлов.** `docker-compose.yml`, nginx-конфиги, `vite.config.ts` — не трогали.

## 📝 Каталог сценариев

Каждый сценарий имеет ID вида `US-{role}{num}`. **Все 11 сценариев покрыты acceptance-тестами против реального backend** (см. колонку «Acceptance файл»); US-G2 и US-G3 проверяются transitively в `US-G5-public-happy-path.spec.ts` (стартует с `/event-types` и проходит через выбор слота → форму → success, что покрывает обе проверки).

### Public (гость)

| ID | Сценарий | Acceptance файл |
|---|---|---|
| **US-G1** | Гость: home → каталог | `US-G1-home-to-catalog.spec.ts` |
| **US-G2** | Каталог показывает типы владельца | transitively через `US-G5-public-happy-path.spec.ts` |
| **US-G3** | Выбор слота в окне 14 дней / рабочих часах | transitively через `US-G5-public-happy-path.spec.ts` |
| **US-G4** | Даты вне окна дизейблятся в календаре | `US-G4-out-of-window-calendar.spec.ts` |
| **US-G5** | Создание брони от начала до конца | `US-G5-public-happy-path.spec.ts` |
| **US-G6** | Гонка за слот: 409 → toast → статус `busy` | `US-G6-slot-conflict-409.spec.ts` |
| **US-G7** | Валидация формы (422 + UI) | `US-G7-public-validation.spec.ts` |

### Owner (админ)

| ID | Сценарий | Acceptance файл |
|---|---|---|
| **US-O1** | `/admin/bookings`: предстоящие в МСК | `US-O1-admin-bookings-list.spec.ts` |
| **US-O2** | Создание типа события | `US-O2-admin-create-event-type.spec.ts` |
| **US-O3** | Редактирование и удаление типа | `US-O3-admin-edit-delete.spec.ts` |
| **US-O4** | Удаление типа сохраняет `event_type_name` в брони | `US-O4-admin-bookings-after-delete.spec.ts` |

### Сквозной (integration owner↔guest)

| ID | Сценарий | Acceptance файл |
|---|---|---|
| **US-INT1** | Owner создаёт тип → guest бронирует → owner видит бронь в МСК | `US-INT1-full-flow.spec.ts` |

## 🚀 Acceptance-сценарии в деталях

### US-G5 — Гость бронирует от начала до конца

| Шаг | Ожидание |
|---|---|
| Запросом к backend создать тип события `name=US-G5 ${Date.now()}` | `POST /api/owner/event-types` → 200, `id` присвоен |
| Открыть `/event-types` | Карточка созданного типа видна |
| Кликнуть по карточке | URL = `/event-types/{id}` |
| В календаре включить дату внутри 14-дневного окна | Кнопка не `disabled` |
| Кликнуть первый слот со статусом `free` | Кнопка «Продолжить» enabled |
| Кликнуть «Продолжить» | URL = `/event-types/{id}/book` |
| Заполнить `Иван Петров` + `ivan@example.com`, нажать «Подтвердить бронирование» | URL = `/event-types/{id}/success` |
| Подтверждение на странице | Видны заголовок «Бронирование подтверждено», имя, e-mail, дата/время в МСК |

### US-G7 — Валидация формы гостя

| Шаг | Ожидание |
|---|---|
| Подготовка (через backend): создать тип события | сделано |
| Открыть `/event-types/{id}`, выбрать дату и слот free | сделано |
| На форме оставить `Имя` пустым, `E-mail` пустым | URL остаётся `/book` |
| Нажать «Подтвердить бронирование» | Backend возвращает 422 `validation_failed` с `details` для `guest_name` и `guest_email`. В UI — toast и/или подсветка полей. URL `/success` НЕ достигнут. |
| Заполнить валидно, нажать «Подтвердить» | URL = `/success` |

### US-O2 — Владелец создаёт тип события через UI

| Шаг | Ожидание |
|---|---|
| Открыть `/admin/event-types` | Таблица пустая (после reset) |
| Кликнуть «Создать тип» | URL = `/admin/event-types/new` |
| `duration_minutes` readonly = 30 | Поле недоступно для правки |
| Ввести `Имя = US-O2 {ts}`, `Описание = acceptance` | Поля заполнены |
| Кликнуть «Создать» | URL = `/admin/event-types`, новая строка в таблице |
| Проверить видимость по `event_type_name` | Строка найдена |

### US-O3 — Владелец редактирует и удаляет тип события

| Шаг | Ожидание |
|---|---|
| Подготовка: создать тип через `POST /api/owner/event-types` | сделано |
| Открыть `/admin/event-types` | Тип в таблице |
| В строке: «Редактировать» | URL = `/admin/event-types/{id}` |
| Изменить `Описание` на «acceptance edited», «Сохранить» | Redirect к списку |
| В строке виден обновлённый `Описание` | Истина |
| В строке: «Удалить» | Открывается `AlertDialog` |
| Подтвердить «Удалить» в диалоге | Строка исчезла из таблицы |

### US-O4 — После удаления типа брони сохраняют имя

| Шаг | Ожидание |
|---|---|
| Подготовка: создать тип, создать бронь через `POST /api/event-types/{id}/bookings` | Бронь существует |
| Открыть `/admin/bookings` | Строка с `event_type_name = <имя типа>` |
| Через UI удалить тип события | сделано |
| Снова открыть `/admin/bookings` | Строка осталась с прежним `event_type_name` (snapshot, см. `test_admin_list_after_event_type_delete_keeps_rows`) — иначе сервер отдаёт `«<удалён>»` |

### US-INT1 — Полный путь owner→guest→owner

| Шаг | Ожидание |
|---|---|
| Владелец: создать тип `US-INT1 {ts}` через UI (`admin/event-types/new`) | сделано (US-O2) |
| Гость: `/event-types` → выбрать карточку → календарь → слот 10:00 (завтра) | сделано (US-G5) |
| Гость: форма → confirm | `/success` |
| Владелец: `/admin/bookings` | Строка с тем же `event_type_name`, датой/временем в МСК-формате |

## 🚀 Как прогнать acceptance

### Требования
- Docker + Docker Compose v2.
- Backend-образ уже собран (`docker compose --profile default up backend` при первом прогоне это сделает).
- В корне репозитория: `npm install` (только husky/commitlint — для самого acceptance-теста не нужен).
- В `frontend/`: предварительно выполнен `npm install` (без `@stoplight/prism-cli`).

### Команды

```bash
# из frontend/
npm run build                  # gen:api + tsc -b + vite build → frontend/dist
npm run test:e2e               # = playwright test → tests/acceptance/*
```

`npm run test:e2e` внутри делает:
1. `globalSetup`: `docker compose --profile default down -v` → `up -d --build --wait backend db`.
2. Polling `http://localhost:8000/api/event-types` до 200 (max 60с; compose `--wait` уже ждёт healthcheck, polling — fallback).
3. Playwright прогоняет все тесты из `frontend/tests/acceptance/` (10 файлов, 11 сценариев).
4. Teardown: тот же `down -v`. In-memory репозитории backend обнуляются при старте процесса — данные, оставшиеся от предыдущего прогона, вытерты.

### Канал запросов в acceptance

```
Playwright → http://localhost:4174 (vite preview, фронт отдан из dist)
            ↓ /api
            Vite proxy (preview.proxy['/api']) → http://localhost:8000 (Django в compose)
            ↑ http://localhost:5432 (postgres, в compose)
```

Compose-frontend НЕ поднимается (если бы поднимался — это лишний оверхед и порт `:3000`). Канал `frontend → /api → backend` один и тот же, что и в проде через nginx, только nginx заменён встроенным прокси Vite.

## 📝 Изменённые файлы

### Новые
1. `docs/devlog/0004-user-scenarios.md` — этот документ.
2. `frontend/tests/acceptance/global-setup.ts` — `docker compose down -v && up --wait` + polling + teardown.
3. `frontend/tests/acceptance/US-G1-home-to-catalog.spec.ts`
4. `frontend/tests/acceptance/US-G4-out-of-window-calendar.spec.ts`
5. `frontend/tests/acceptance/US-G5-public-happy-path.spec.ts`
6. `frontend/tests/acceptance/US-G6-slot-conflict-409.spec.ts`
7. `frontend/tests/acceptance/US-G7-public-validation.spec.ts`
8. `frontend/tests/acceptance/US-O1-admin-bookings-list.spec.ts`
9. `frontend/tests/acceptance/US-O2-admin-create-event-type.spec.ts`
10. `frontend/tests/acceptance/US-O3-admin-edit-delete.spec.ts`
11. `frontend/tests/acceptance/US-O4-admin-bookings-after-delete.spec.ts`
12. `frontend/tests/acceptance/US-INT1-full-flow.spec.ts`

### Удалённые (ранее: mock-e2e набор, заменён acceptance'ом)
- `frontend/tests/e2e/public-booking.spec.ts`
- `frontend/tests/e2e/public-slot-conflict.spec.ts`
- `frontend/tests/e2e/public-slot-out-of-window.spec.ts`
- `frontend/tests/e2e/admin-event-types.spec.ts`
- `frontend/tests/e2e/admin-bookings.spec.ts`
- `frontend/tests/e2e/global-setup.ts`

### Изменённые
13. `frontend/playwright.config.ts` — один webServer-стек `[compose backend+db, vite preview :4174]`; `RUN_MODE` switch и параллельная ветка под Prism убраны; `testDir = ./tests/acceptance`.
14. `frontend/package.json` — скрипты `RUN_MODE=…` сняты, `npm run mock` удалён, `@stoplight/prism-cli` удалён из devDependencies. Остался один `test:e2e`.

### Не тронуты
- `docker-compose.yml` (его `frontend-only` профиль всё ещё поднимает Prism-контейнер для ручной разработки без бэкенда — это полезно, но не используется в тестах), `backend/**`, `frontend/vite.config.ts`, `frontend/nginx*.conf`, `frontend/src/**`, `spec/**`.

## ⚙️ Важные детали

### Каждый тест уникален внутри прогона
Каждый acceptance-тест использует `name = \`US-XXX ${Date.now()}-${rand}\`` для типов и гостей — чтобы избежать коллизий при запуске через `--repeat-each` или локальной отладке. `globalSetup` уже делает reset, но защита на уровне имён упрощает расследование падений.

### Vite preview proxy
В `vite.config.ts:preview.proxy['/api']` уже заложен `API_PROXY_TARGET` env — он пробрасывается через `playwright.config.ts:webServer.env`. Это позволяет ходить в `:4174/api/...`, а Vite сам форвардит в `:8000`.

### Идемпотентность при сбое
Если acceptance упал на полпути, повторный запуск без `down -v` в teardown оставит данные в compose. `globalSetup` каждый раз делает `down -v` — успешный или провальный, следующий прогон гарантированно чист.

### Backend в compose-only
`docker compose --profile default down -v` опускает ВСЕ сервисы профиля `default`. Для acceptance это безопасно — `vite preview` слушает независимо. После `up backend db` поднимаются только эти два; контейнер `frontend` (`:3000`) из compose не запускается (не нужен — мы отдаём UI из локального `vite preview`).

### Точки риска
- **First-time build тяжёлый.** Backend-образ ~300 MB, первая сборка через `--build` ~1–2 минуты. Дальнейшие прогоны — секунды, если образ уже собран и изменения только в коде.
- **`--strictPort` для preview.** `:4174` должен быть свободен перед стартом.
- **TZ в acceptance.** Все вычисления дат — `date-fns-tz` + `Europe/Moscow`. Использовать `toZonedTime(new Date(), MSK)` для `today`, не `new Date()` напрямую.
- **`sessionStorage` для success-страницы.** После `await page.getByRole('button', { name: /Подтвердить/ }).click()` сразу `toHaveURL(/success/)`.
- **Гонка за слот US-G6 теперь детерминированная.** Без `page.route()` нельзя контролировать точный момент 409. Тест сидит бронь на тот `start_at`, который собирается выбрать UI (parsing "HH:mm — HH:mm" из кнопки). UI потом сабмитит → backend видит занятый слот → 409. Альтернатива — параллельные browser contexts; выбрали однозначный детерминизм.
- **US-G2/US-G3 transitively.** Если разделение по файлам станет полезным для failure-labels — выделить в отдельные acceptance-файлы отдельным тикетом. На текущем шаге дублировать US-G5 не имеет смысла.

## 🎉 Итог

Единый канонический acceptance-набор из 10 файлов / 11 пользовательских сценариев покрывает всю публичную и админскую поверхность через связку `frontend (vite preview) ↔ backend (Django в compose) ↔ db (postgres в compose)`. Моки (`page.route`, Prism-параллель) удалены как дублирующий слой. Каталог сценариев и канал прогона задокументированы в этом devlog и `AGENTS.md`.
