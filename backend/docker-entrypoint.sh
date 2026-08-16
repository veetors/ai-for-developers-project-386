#!/bin/sh
set -eu

PORT="${PORT:-8000}"

exec uvicorn config.asgi:application \
    --host 0.0.0.0 \
    --port "$PORT" \
    --proxy-headers
