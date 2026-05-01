# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
LABEL stage=builder

WORKDIR /app

# Install dependencies (including devDeps for build)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Ensure /app/public exists even if the project has no public assets,
# so the COPY in the runtime stage never fails on a clean checkout.
RUN mkdir -p /app/public

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
LABEL stage=runtime
LABEL service="frontend"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set up user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]