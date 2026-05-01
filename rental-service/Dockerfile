# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM python:3.12-alpine AS builder

LABEL stage="builder"

WORKDIR /build

RUN apk add --no-cache gcc musl-dev

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.12-alpine AS runtime

LABEL stage="runtime"
LABEL service="rental-service"

WORKDIR /app

RUN apk add --no-cache wget

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8002

ENV DJANGO_SETTINGS_MODULE=core.settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8002", "--workers", "2", "--timeout", "120"]