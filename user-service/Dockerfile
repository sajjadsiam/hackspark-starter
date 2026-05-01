# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache gcc musl-dev libpq-dev

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-alpine AS runtime

WORKDIR /app

# Install only runtime libs
RUN apk add --no-cache libpq wget

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

EXPOSE 8001

ENV DJANGO_SETTINGS_MODULE=core.settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Entrypoint: run migrations then start gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:8001 --workers 2 --timeout 120"]