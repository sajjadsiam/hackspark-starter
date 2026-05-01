# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./
# Use npm install since package-lock.json might be missing
RUN npm install --omit=dev

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

LABEL stage="runtime"
LABEL service="api-gateway"

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
# Copy application source
COPY . .

EXPOSE 8000

ENV NODE_ENV=production

CMD ["node", "index.js"]