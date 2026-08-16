FROM python:3.14-slim AS builder

ENV POETRY_VERSION=2.4.1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

RUN pip install --no-cache-dir "poetry==${POETRY_VERSION}" "poetry-plugin-export==1.8.0"

WORKDIR /app

COPY pyproject.toml poetry.lock* ./
RUN poetry export --only main -f requirements.txt \
    --output /tmp/requirements.txt \
 && pip wheel --wheel-dir=/wheels -r /tmp/requirements.txt

FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /wheels /wheels
COPY --from=builder /tmp/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /tmp/requirements.txt \
 && rm -rf /wheels

COPY manage.py ./
COPY config ./config
COPY booking ./booking
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD curl -fsS "http://localhost:${PORT}/api/event-types" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]


