#!/bin/sh
set -eu

PORT="${PORT:-8000}"
API_SOCKET=/tmp/booking-api.sock

uvicorn config.asgi:application --uds "$API_SOCKET" --proxy-headers &
API_PID=$!

ready=0
i=0
while [ "$i" -lt 30 ]; do
    if curl -fsS --unix-socket "$API_SOCKET" "http://localhost/api/event-types" >/dev/null 2>&1; then
        ready=1
        break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo "API process exited unexpectedly" >&2
        exit 1
    fi
    i=$((i + 1))
    sleep 1
done

if [ "$ready" -ne 1 ]; then
    echo "API did not become ready in time" >&2
    exit 1
fi

export PORT
envsubst '${PORT}' </etc/nginx/nginx.conf.template >/etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
