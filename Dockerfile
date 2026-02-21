# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# --- Stage 2: Build the Next.js app ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build argument for base path (can be overridden with --build-arg)
ARG BASE_PATH=${BASE_PATH}
ENV NEXT_PUBLIC_BASE_PATH=${BASE_PATH}
ENV NEXT_PUBLIC_API_BASE_URL=${BASE_PATH}

RUN npm run build

# --- Stage 3: Production Runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3004
# Ensure server listens on all interfaces
ENV HOSTNAME="0.0.0.0"
EXPOSE 3004

# Add tini
RUN apk add --no-cache tini curl nano vim iputils busybox-extras bash

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Bake environment variables into the final image
# This ensures that variables like proxy credentials are automatically
# available at runtime without needing external env files on the Prod server.
COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./

USER nextjs

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "--env-file=.env.local", "server.js"]
