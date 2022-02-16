#!/bin/bash
## This scripts serves as the Docker entrypoint.
## If any command is specified, it runs it as is,
## else, it runs the appserver Flask application.

set -e

if [ "$1" ]; then
  ## A command is specified, then run it.
  exec "$@"
else
  if [ "$MIGRATE_DB" ]; then
    ## If $MIGRATE_DB is set, wait for PostgreSQL and run any required migrations.
    while ! curl $POSTGRES_HOST:$POSTGRES_PORT 2>&1 | grep '52'; do
      echo "Waiting for PostgreSQL to be available in $POSTGRES_HOST:$POSTGRES_PORT"
      sleep 5;
    done
    echo "PostreSQL is ready. Executing DB migrations now"
    flask db upgrade --x-arg data_migrate="True"
    echo "Finished executing DB migrations"
  fi

  ## Create initial user if $INITIAL_ADMIN_EMAIL is set.
  if [ "$INITIAL_ADMIN_EMAIL" ]; then
    echo "Trying to create initial admin user: $INITIAL_ADMIN_EMAIL"
    flask create-user "Admin" "$INITIAL_ADMIN_EMAIL" > /dev/null 2>&1 || true
    flask set-role "$INITIAL_ADMIN_EMAIL" "admin" > /dev/null 2>&1 || true
  fi

  ## Run the Flask appserver app, using the built-in development Flask server,
  ## or gunicron WSGI server if the $FLASK_ENV is not set to development.
  if [ "${FLASK_ENV}" = "development" ]; then
    flask run -h 0.0.0.0 -p ${PORT:-5000}
  else
    gunicorn \
      -b 0.0.0.0:${PORT:-5000} \
      --workers=${GUNICORN_WORKERS:-9} \
      --threads=${GUNICORN_THREADS:-10} \
      --timeout=${GUNICORN_TIMEOUT:-300} \
      --max-requests=${GUNICORN_MAX_REQUESTS:-120} \
      app:app
  fi
fi
