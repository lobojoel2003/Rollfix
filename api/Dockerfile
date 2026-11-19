# syntax=docker/dockerfile:1
# Rollfix stats API. Build from the api/ directory:
#   docker build -t rollfix-api api/
FROM python:3.15-slim AS build
RUN pip install --no-cache-dir --root-user-action=ignore "uv==0.11.*"
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY rollfix_api ./rollfix_api
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.15-slim
ARG VERSION=dev
ARG BUILD_NUMBER=dev
ARG COMMIT=unknown
LABEL org.opencontainers.image.title="rollfix-api" \
      org.opencontainers.image.description="Rollfix stats API: opt-in anonymous wheelchair repair delay numbers" \
      org.opencontainers.image.source="https://github.com/lobojoel2003/Rollfix" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}"
RUN useradd --system --uid 10001 --no-create-home rollfix
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ROLLFIX_BUILD_NUMBER=${BUILD_NUMBER} \
    ROLLFIX_COMMIT=${COMMIT}
USER rollfix
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"]
# No access log: the API never records who shared what.
CMD ["uvicorn", "rollfix_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--no-server-header"]
