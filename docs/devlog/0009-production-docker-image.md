# Продакшен-образ: полный стек в одном контейнере (Docker, PORT)

## 🎯 Проблема
Требование шага «деплой»: в репозитории должен быть `Dockerfile`, по которому
проверка собирает образ и запускает приложение, которое автоматически стартует
на порту из переменной окружения `PORT`. До этого:
- в корне не было `Dockerfile` (только `backend/Dockerfile` и `Dockerfile.frontend`), `docker build .` падал;
- uvicorn в `backend/Dockerfile` хардкодил `--port 8000` и игнорировал `PORT`;
- nginx фронта слушал жёстко `8080`.

## ✅ Решение
Корневой multi-stage `Dockerfile` собирает SPA и API в один продакшен-образ:
1. `frontend-build` (node:24-alpine) — `npm ci`, генерация TS-типов из контракта, `tsc -b`, `vite build`;
2. `backend-build` (python:3.14-slim) — `poetry export --only main` → `pip wheel`;
3. `runtime` (python:3.14-slim + apt `nginx`, `curl`, `gettext-base`) — pip-установка колёс, копирование `backend/{manage.py,config,booking}` и `dist` SPA.

Ключевое решение — **API на unix-сокете** (`--uds /tmp/booking-api.sock`), nginx
проксирует `/api` и `/healthz` на него. Это исключает коллизию портов, когда
`PORT == 8000` (uvicorn на `127.0.0.1:8000` конфликтовал бы с `listen $PORT`).

`docker-entrypoint.sh`:
- стартует uvicorn на unix-сокете в фоне;
- ждёт готовности через `curl --unix-socket .../api/event-types` (fail-fast при падении процесса);
- `envsubst '${PORT}'` рендерит `nginx.conf.template` (подставляется только `$PORT`, `$uri`/`$host` не трогаются);
- `exec nginx -g 'daemon off;'` — nginx становится PID 1.

`backend/Dockerfile` переведён с shell-`CMD` (lint-warning `JSONArgsRecommended`)
на exec-`ENTRYPOINT ["docker-entrypoint.sh"]`: скрипт читает `${PORT:-8000}` и
exec'ит uvicorn — корректная передача сигналов + поддержка `PORT`.

## 📝 Изменённые файлы
1. `Dockerfile` — новый: multi-stage полный стек (SPA + API) в одном образе
2. `nginx.conf.template` — новый: `listen ${PORT}`, SPA-fallback, `/api/` и `/healthz` → unix-сокет API
3. `docker-entrypoint.sh` — новый: uvicorn на unix-сокете → envsubst PORT → nginx
4. `.dockerignore` — расширен для корневого build-контекста (`**/node_modules`, `**/.venv`, `frontend/dist`, `frontend/src/api/generated`, `docs`, `.github` и т.п.)
5. `backend/Dockerfile` — `ENTRYPOINT`-скрипт вместо shell-`CMD` (использует `$PORT`)
6. `backend/docker-entrypoint.sh` — новый: uvicorn на `$PORT` (дефолт 8000)
7. `README.md` — раздел «Продакшен-образ» с `docker build` / `docker run -e PORT=...`

## 🚀 Как протестировать
```bash
docker build -t booking-service .
docker run --rm -p 8080:8080 -e PORT=8080 booking-service
curl -s http://localhost:8080/                  # 200 text/html (SPA)
curl -s http://localhost:8080/api/event-types   # 200 JSON (API через nginx)
curl -s http://localhost:8080/healthz           # {"status": "ok"}
```
Проверены `PORT` = 8000 (дефолт), 8080, 9090; healthcheck — `healthy`; полный
сценарий бронирования (создание типа события → слоты → бронь → занятость →
список owner-букингов) прошёл через nginx-прокси. `docker build --check .` — без
warnings. `backend/Dockerfile` проверен отдельно на `PORT=8765`.

## ⚙️ Важные детали
- nginx слушает `$PORT` (внешний), API — только unix-сокет; коллизий портов нет ни при каком `PORT`.
- `envsubst '${PORT}'` — единственная переменная подстановки; nginx-директивы `$uri`, `$host` остаются интактными.
- `EXPOSE 8000` в обоих Dockerfile — информационно (запросы приходят на `$PORT`).
- Root-образ и образ `backend` остались совместимы с существующим `docker-compose.yml` (`compose config` валиден).

## 🎉 Итог
Репозиторий получил корневой `Dockerfile`: собранный образ автоматически стартует
в контейнере, отдаёт SPA и API на порту из `PORT`, готов к деплою и к
автоматической проверке проекта.
