# syntax=docker/dockerfile:1

# Production image for the whole "Запись на звонок" app: the SPA is served by
# nginx, which reverse-proxies /api to the Django API running in the same
# container. The container listens on the $PORT env var (default 8000).

# ---------- Stage 1: build the SPA ----------
FROM node:24-alpine AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
COPY spec/generated/openapi.yaml ./contract/openapi.yaml

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Generate TS types directly from the bundled contract (avoid npm run gen:api,
# which resolves `../spec/generated/openapi.yaml` relative to /app).
RUN npx openapi-typescript ./contract/openapi.yaml -o src/api/generated/schema.d.ts \
    && npx tsc -b \
    && npx vite build

# ---------- Stage 2: build backend wheels ----------
FROM python:3.14-slim AS backend-build

ENV POETRY_VERSION=2.4.1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}" "poetry-plugin-export==1.8.0"

WORKDIR /app

COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry export --only main -f requirements.txt \
    --output /tmp/requirements.txt \
 && pip wheel --wheel-dir=/wheels -r /tmp/requirements.txt

# ---------- Stage 3: runtime (nginx + Django API) ----------
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    PORT=8000

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl nginx gettext-base \
 && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /wheels /wheels
COPY --from=backend-build /tmp/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /tmp/requirements.txt \
 && rm -rf /wheels /tmp/requirements.txt

COPY backend/manage.py ./
COPY backend/config ./config
COPY backend/booking ./booking

COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD curl -fsS "http://localhost:${PORT}/api/event-types" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
