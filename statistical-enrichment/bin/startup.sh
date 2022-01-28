#!/bin/bash

if [ "${FLASK_ENV}" = "development" ]; then
    flask run \
      --host 0.0.0.0 \
      --port ${PORT:-5000}
else
    gunicorn \
      -b 0.0.0.0:${PORT:-5000} \
      --workers=${GUNICORN_WORKERS:-2} \
      --threads=${GUNICORN_THREADS:-2} \
      --timeout=${GUNICORN_TIMEOUT:-1200} \
      --max-requests=${GUNICORN_MAX_REQUESTS:-120} \
      wsgi:app
fi
