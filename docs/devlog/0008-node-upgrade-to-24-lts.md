# Обновление Node.js до LTS 24

## 🎯 Задача
Поднять Node.js в проекте с 20/22 на актуальный LTS **24** (последний релиз — 24.19.0).

## ✅ Решение
Версия фиксируется на мажоре `24` (не пиним патч): `node-version: 24` в CI и `node:24-alpine` в Docker — свежие patch-релизы подтягиваются автоматически.

1. `.github/workflows/ci.yml` — `node-version` поднят с 20/22 до 24 во всех трёх джобах (`Spec / contract`, `Frontend`, `E2E`).
2. `Dockerfile.frontend` — образ сборки `node:20-alpine` → `node:24-alpine`.
3. `spec/02-frontend-architecture.md` — документация (раздел 9.2) приведена к актуальному Dockerfile.
4. `frontend/package.json` — devDependency `@types/node` `^22.9.0` → `^24` (типы Node-API соответствуют рантайму); `frontend/package-lock.json` перегенерирован.

## 📝 Изменённые файлы
1. `.github/workflows/ci.yml` — `node-version: 22/20` → `24` (3 джобы)
2. `Dockerfile.frontend` — `FROM node:20-alpine` → `FROM node:24-alpine`
3. `spec/02-frontend-architecture.md` — образ сборки в доках
4. `frontend/package.json` — `@types/node` `^22.9.0` → `^24.13.3`
5. `frontend/package-lock.json` — перегенерирован после обновления `@types/node`

## 🚀 Как протестировать
1. `cd frontend && npm run lint && npm run typecheck` — зелёные.
2. `npm run test:unit` — 20 тестов, все проходят.
3. `npm run build` — сборка на Node 24 успешна.
4. `docker build -f Dockerfile.frontend -t booking-service-frontend:check .` — smoke-сборка образа на `node:24-alpine` успешна (npm ci + tsc + vite build).
5. Пуш ветки и повторный прогон CI.

## ⚙️ Важные детали
- Backend и `docker-compose.yml` не затронуты: бэкенд на Python, а compose собирает frontend через `Dockerfile.frontend` (прямых ссылок на версию Node нет).
- `hexlet-check.yml` автогенерируемый — не редактировался.
- Ветка: мажорный пин `24`, т.к. целевой релиз 24.19.0 — последний в линейке LTS.

## 🎉 Итог
Проект полностью переведён на Node.js LTS 24: CI, Docker-образ сборки, документация и типы `@types/node`. Локальные проверки и Docker-сборка прошли зелёными.
