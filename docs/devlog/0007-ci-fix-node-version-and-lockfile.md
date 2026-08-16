# Фикс CI: Node 22 для TypeSpec и обновление backend/poetry.lock

## 🎯 Проблема
В PR #3 упали два чека GitHub Actions:

1. **CI / Spec / contract** — шаг `Compile TypeSpec` завершался с кодом 1. Причина: `@typespec/compiler@1.15.0` объявляет `engines.node >= 22.0.0`, а CI-джоба использовала `node-version: 20` → `tsp compile` падал в рантайме. Локально (Node 26) ошибка не воспроизводилась.
2. **CI / Backend** — шаг `poetry install` завершался с кодом 1: «pyproject.toml changed significantly since poetry.lock was last generated». Content-hash в закоммиченном `poetry.lock` не совпадал с `pyproject.toml` (стale lock). e2e-джоба проходила, т.к. Docker-сборка использует `poetry export --only main`, который content-hash не валидирует.

## ✅ Решение
1. `.github/workflows/ci.yml` — в джобе `Spec / contract` `node-version` поднят с 20 до 22 (удовлетворяет engines TypeSpec-компилятора). Frontend/e2e остались на 20 — они прошли и соответствуют `node:20-alpine` в Docker.
2. `backend/poetry.lock` — перегенерирован через `poetry lock`: обновлён `content-hash`, из lock удалены 7 «лишних» транзитивных пакетов (cachecontrol, certifi, charset-normalizer, msgpack, pip, requests, urllib3), попавших туда ранее от `poetry-plugin-export`. Реальные зависимости не изменились.

## 📝 Изменённые файлы
1. `.github/workflows/ci.yml` — `node-version: 20` → `22` в джобе Spec / contract
2. `backend/poetry.lock` — перегенерирован (content-hash + чистка транзитивных пакетов)

## 🚀 Как протестировать
1. `cd backend && poetry check --lock` — без ошибок; `poetry install --dry-run` — резолвится; `poetry run ruff check . && poetry run pytest` — зелёные.
2. `cd spec && npm run compile && git diff --exit-code generated/openapi.yaml` — без изменений.
3. Пуш ветки и повторный прогон CI: обе упавшие джобы должны стать зелёными.

## ⚙️ Важные детали
- `poetry lock` по умолчанию не обновляет уже зафиксированные версии пакетов — diff ограничился удалением чужих транзитивных зависимостей и сменой content-hash.
- Локальный Node 26 тоже проходит, но минимально-необходимая версия для компиляции контракта — 22.
- Docker-сборка бэкенда не затронута: `poetry export` продолжает работать (требует `poetry-plugin-export`, который ставится в builder-стадии).

## 🎉 Итог
Обе причины падения CI устранены: TypeSpec компилируется на Node 22, а `poetry install` снова принимает lockfile. Осталось подтвердить зелёным прогоном GitHub Actions после пуша.
