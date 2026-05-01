# ── Stage 1: builder ─────────────────────────────────────────────────────────
# Compile wheels and install all deps in a build environment
FROM python:3.12-alpine AS builder

LABEL stage="builder"

WORKDIR /build

# Install build dependencies (gcc needed for some Python packages)
RUN apk add --no-cache gcc musl-dev libpq-dev

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
# Lean runtime image - no build tools, smaller footprint
FROM python:3.12-alpine AS runtime

LABEL stage="runtime"
LABEL service="user-service"

WORKDIR /app

# Only runtime C libs needed
RUN apk add --no-cache libpq wget

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

EXPOSE 8001

ENV DJANGO_SETTINGS_MODULE=core.settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Run migrations then start gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:8001 --workers 2 --timeout 120"]