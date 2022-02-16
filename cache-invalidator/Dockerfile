# ========================================
# Base image
# ========================================
FROM python:3.10-slim as base

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONFAULTHANDLER 1

RUN pip install pipenv


# ========================================
# Build dependencies stage
# ========================================
FROM base as build-deps

# Copy Pipfiles
COPY Pipfile Pipfile.lock ./

# Install Python dependencies
ARG DEV
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy $(if [ "$DEV" ]; then echo --dev; fi)


# ========================================
# Runtime stage
# ========================================
FROM base
LABEL org.opencontainers.image.source https://github.com/SBRG/lifelike

# Copy Python virtual environment
COPY --from=build-deps /.venv /.venv
ENV PATH="/.venv/bin:$PATH"

# Set user and working directory
WORKDIR /app
RUN useradd -m -d /app app
USER app

# Copy application code
COPY --chown=app main.py ./

# Neo4j configuration
ENV NEO4J_HOST=neo4j
ENV NEO4J_PORT=7687
ENV NEO4J_AUTH=neo4j/password
ENV NEO4J_SCHEME=bolt
ENV NEO4J_DATABASE=neo4j

# Redis cache configuration
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=password
ENV REDIS_DB=0

# Default TTL for cache
ENV CACHE_TTL=86400

# Logging level
ENV LOG_LEVEL=INFO

CMD ["python", "main.py"]
