# CI через GitHub Actions + автоматические релизы через release-please

## 🎯 Проблема
Проект имел только автогенерируемый `hexlet-check.yml` (внешние проверки Hexlet) и локальный enforcement conventional commits (commitlint). Отсутствовали:
- автоматические интеграционные проверки на каждый PR к `main` — контракт, фронтенд, бэкенд и e2e-сценарии бронирования,
- автоматические релизы и changelog: после мёрджа в основную ветку версия, тег и changelog приходилось бы собирать вручную.

## ✅ Решение
1. **CI workflow** `.github/workflows/ci.yml` (триггеры: `pull_request` к `main`, `push` в `main`) с четырьмя независимыми джобами:
   - `Spec / contract` — `npm ci` + `npm run compile` (TypeSpec → OpenAPI) и страж `git diff --exit-code spec/generated/openapi.yaml`, что сгенерированный контракт всегда закоммичен;
   - `Frontend` — `gen:api` → `lint` → `typecheck` → `test:unit` → `build` (порядок из AGENTS.md);
   - `Backend` — Poetry 2.4.1 + Python 3.14: `poetry install` → `ruff check .` → `pytest`;
   - `E2E (real stack)` — `npm run test:e2e`: все acceptance-тесты Playwright (включая US-G5/INT1 — основной сценарий бронирования) против реального стека `docker compose --profile default` (nginx → backend:8000), Chromium ставится через `npx playwright install --with-deps chromium`, при падении загружается артефакт `frontend/test-results/`.
2. **Release-please** — одна версия на весь репозиторий:
   - `release-please-config.json` — `packages: { ".": { release-type: node, bump-minor-pre-major: true, changelog-sections } }` (single-package root);
   - `.release-please-manifest.json` — `{ ".": "0.1.0" }` (текущая версия корневого пакета);
   - `.github/workflows/release-please.yml` — `googleapis/release-please-action@v4` на `push` в `main` с `permissions: contents: write, pull-requests: write`.

Поведение: после мёрджа в `main` release-please создаёт/обновляет единый release-PR с `CHANGELOG.md` и предложенной версией; после мёржа release-PR бампает версию в `package.json`/`package-lock.json`, создаёт тег `vX.Y.Z` и GitHub Release. При текущем `0.1.0` и `feat`-коммитах первый PR предложит `0.2.0`.

## 📝 Изменённые файлы
1. `.github/workflows/ci.yml` — новый: 4 джобы (contract, frontend, backend, e2e)
2. `.github/workflows/release-please.yml` — новый: release-please-action на push в main
3. `release-please-config.json` — новый: конфиг single-package release-please
4. `.release-please-manifest.json` — новый: текущая версия `0.1.0`
5. `README.md` — раздел «CI и релизы», обновлён «Статус»

## 🚀 Как протестировать
1. Локально: `cd spec && npm run compile`; `cd ../frontend && npm run gen:api && npm run lint && npm run typecheck && npm run test:unit && npm run build`; `cd ../backend && poetry run ruff check . && poetry run pytest`.
2. После пуша ветки в GitHub — убедиться, что в PR запустились 4 джобы CI и проходят.
3. После мёрджа в `main` — проверить, что release-please открыл release-PR с `CHANGELOG.md` и предложенной версией; после мёржа этого PR — тег `v0.2.0` и GitHub Release.

## ⚙️ Важные детали
- `hexlet-check.yml` и `.github/workflows/README.md` не тронуты (автогенерируемые, по требованиям Hexlet).
- Корневой `npm install` в CI не нужен — commitlint/husky работают только локально.
- e2e-джоба требует Docker: `webServer` и `globalSetup` Playwright поднимают compose дважды, но образы кешируются, повторный `up` быстрый.
- Версии в CI зафиксированы: Node 20 (как в `Dockerfile.frontend`), Poetry 2.4.1 (как в `backend/Dockerfile`), Python 3.14.
- Реальные прогоны workflow видны только после пуша в GitHub; локально валидируется лишь содержимое (компиляция, линт, тесты).

## 🎉 Итог
Настроены автоматические интеграционные проверки (включая полный e2e-сценарий бронирования против реального стека) и автоматические релизы: release-PR с changelog после мёржа в main, тег и GitHub Release при мёрдже release-PR.
