# Фикс acceptance: snapshot event_type_name + русские сообщения ошибок

## 🎯 Проблема
Playwright acceptance-прогон падал в двух сценариях:

1. **US-G6** (`slot-conflict-409`) — при 409 на занятый слот ожидался тост «Слот только что заняли», но показывался английский `"Slot is already booked."`. Причина: фронт `errorMessageFor` (преднамеренно) предпочитает серверный `message`, а бэкенд отдавал все сообщения ошибок на английском, хотя продукт русскоязычный.
2. **US-O4** (`admin-bookings-after-delete`) — после удаления типа события бронь в админ-списке отображала `«<удалён>»` вместо сохранённого имени. Причина: у `Booking` не было snapshot `event_type_name`, имя подставлялось на чтении из ещё существующего типа, а после удаления заменялось заглушкой.

Дополнительно: e2e-globalSetup ждал `http://localhost:8000` с хоста, но порт 8000 бэкенда в docker-compose только `expose`d (не опубликован) → прогон падал до старта тестов.

## ✅ Решение
1. **Snapshot имени типа:** в `Booking` добавлено поле `event_type_name: str`, заполняется при создании брони; `list_upcoming_admin` читает имя из snapshot. Убран слой подстановки `«<удалён>»` и ставший ненужным `event_type` в `AdminBookingRow`.
2. **Локализация:** все `AppError`-сообщения в сервисах (`bookings`, `event_types`, `slots`) переведены на русский, тексты совпадают с дефолтами `frontend/src/api/errors.ts`. Для кириллицы в `ruff.toml` добавлен `allowed-confusables` (RUF001 на русских UI-строках — ложные срабатывания).
3. **e2e-инфраструктура:** `global-setup.ts` проверяет готовность через `http://localhost:3000/api/event-types` (цепочка nginx→backend), т.к. с хоста доступен только nginx.

## 📝 Изменённые файлы
1. `backend/booking/domain.py` — поле `event_type_name` в `Booking`
2. `backend/booking/repositories/memory.py` — проброс snapshot в `add`/`reserve`
3. `backend/booking/services/bookings.py` — snapshot при создании, `list_upcoming_admin` из snapshot, упрощён `AdminBookingRow`, удалён неиспользуемый `EventTypeRepo`-параметр, русские сообщения
4. `backend/booking/services/event_types.py` — русские сообщения
5. `backend/booking/services/slots.py` — русские сообщения
6. `backend/booking/api/deps.py` — `get_booking_service` без `event_types=`
7. `backend/booking/tests/test_admin_bookings.py` — хелпер + ассерт snapshot (`"Soon gone"` вместо `"<удалён>"`)
8. `backend/booking/tests/test_slot_grid.py` — `event_type_name` в конструкции `Booking`
9. `backend/ruff.toml` — `allowed-confusables` для кириллицы/en-dash
10. `frontend/tests/acceptance/global-setup.ts` — health-check через `localhost:3000`
11. `AGENTS.md` — синхронизированы разделы про e2e/docker/`API_PROXY_TARGET`

## 🚀 Как протестировать
1. `cd backend && poetry run pytest` (27 passed) + `poetry run ruff check .`
2. `cd frontend && npm run lint && npm run typecheck && npm run test:unit` (20 passed)
3. `npm run build && npm run test:e2e` (11 passed, включая US-G6 и US-O4)

## ⚙️ Важные детали
- Контракт OpenAPI не менялся: `AdminBooking.event_type_name` и раньше был required `string` — изменилось лишь содержимое (snapshot вместо `<удалён>`).
- Русские тексты ошибок повторяют дефолты фронта, поэтому при отсутствии `message` у сервера поведение не деградирует.
- `allowed-confusables` ограничен 5 символами (С/с/М/К/–); при появлении других кириллических символов в строках может потребоваться расширение списка.

## 🎉 Итог
Весь набор проверок (бэкенд-юниты, ruff, линт/typecheck/юниты фронта, build, 11 acceptance-сценариев) полностью зелёный; оба ранее падавших сценария проходят.
