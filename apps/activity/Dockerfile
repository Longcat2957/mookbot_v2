# syntax=docker/dockerfile:1.7
# build context: monorepo root (mookbot_v2/)
FROM node:25-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
COPY apps/activity/package.json apps/activity/
RUN pnpm install --frozen-lockfile --filter @mookbot/activity...

ARG VITE_DISCORD_CLIENT_ID
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

COPY apps/activity apps/activity
RUN pnpm --filter @mookbot/activity build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/activity/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=2 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
