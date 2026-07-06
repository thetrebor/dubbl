# =============================================================================
# Dubbl - Production Dockerfile (multi-stage)
# =============================================================================

# --- Base ---
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry by default - disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time values: secrets use placeholders (real values injected at runtime).
# NEXT_PUBLIC_APP_URL is the exception — Next.js inlines it at build time, so it
# must be the real URL. It is passed via --build-arg from docker compose.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-placeholder"
ENV STRIPE_SECRET_KEY="sk_test_build_placeholder"
ENV STRIPE_WEBHOOK_SECRET="whsec_build_placeholder"

RUN pnpm build

# --- Production ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
