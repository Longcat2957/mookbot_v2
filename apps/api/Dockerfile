# syntax=docker/dockerfile:1.7
# build context: monorepo root (mookbot_v2/)
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY apps/activity/package.json apps/activity/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @mookbot/core build \
 && pnpm --filter @mookbot/api build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY apps/activity/package.json apps/activity/
RUN pnpm install --frozen-lockfile --prod \
        --filter @mookbot/api... \
 && pnpm store prune
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 3000
WORKDIR /app/apps/api
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1 || exit 1
CMD ["node", "dist/index.js"]
