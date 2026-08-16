# Деплой на Render: Blueprint render.yaml, запуск по PORT

## 🎯 Проблема
Требование шага «деплой»: приложение должно разворачиваться на Render и
автоматически стартовать на порту из переменной окружения `PORT`. В репозитории
уже был корневой `Dockerfile` (SPA + API, nginx на `$PORT`), но не было
конфигурации деплоя: Render не знал, какой Dockerfile собирать, куда ходить
healthcheck'ом и какую ветку деплоить.

## ✅ Решение
Добавлен `render.yaml` — Blueprint Render (Infrastructure-as-Code, версионируется
вместе с кодом):

- `runtime: docker` — Render собирает корневой `Dockerfile` через BuildKit;
- `dockerfilePath: ./Dockerfile`, `dockerContext: .`;
- `healthCheckPath: /healthz` — nginx проксирует `/healthz` на Django healthz (`{"status":"ok"}`);
- `plan: free`, `region: frankfurt`, `branch: main`, `autoDeploy: true`;
- `DJANGO_DEBUG=0` — выключен debug в проде.

Как работает `PORT` на Render: Render инжектит `PORT` (по умолчанию 10000) для
веб-сервисов. `docker-entrypoint.sh` читает `$PORT`, `envsubst` рендерит
`nginx.conf.template` (`listen ${PORT}`), nginx слушает `0.0.0.0:$PORT` — именно
этот порт и видит порт-сканер Render. Правки в Dockerfile/entrypoint не
потребовались.

## 📝 Изменённые файлы
1. `render.yaml` — новый: Blueprint веб-сервиса booking-service (runtime docker)
2. `README.md` — раздел «Деплой на Render», строка в структуре репозитория

## 🚀 Как протестировать
1. Пуш в `main` → авто-деплой (`autoDeploy`).
2. Blueprint Apply:
   https://dashboard.render.com/blueprint/new?repo=https://github.com/veetors/ai-for-developers-project-386
3. Проверка:
   - `curl https://booking-service-3k4r.onrender.com/` → 200 SPA
   - `curl https://booking-service-3k4r.onrender.com/healthz` → `{"status":"ok"}`
   - `curl https://booking-service-3k4r.onrender.com/api/event-types` → `[]` 200

## ⚙️ Важные детали
- MCP Render не умеет создавать Docker-сервисы (`runtime: docker` недоступен в
  `render_create_web_service`), поэтому использован Blueprint.
- `PORT` в blueprint не задан — Render сам инжектит его (10000).
- `DJANGO_SECRET_KEY` оставлен dev-дефолт: in-memory хранилище без сессий, для
  демо безопасно.
- Free-план Render засыпает после ~15 минут без трафика; первый запрос после
  пробуждения занимает до минуты.
- Сборка: multi-stage Docker (node:24-alpine → python:3.14-slim), linux/amd64.

## 🎉 Итог
Сервис задеплоен и `live`: https://booking-service-3k4r.onrender.com. SPA, `/healthz`
и `/api/*` отвечают 200; ошибок в логах нет. Приложение стартует по `$PORT`,
как требует шаг «деплой».
