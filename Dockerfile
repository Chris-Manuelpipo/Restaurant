# ═══════════════════════════════════════════════════════════════════════════
#  Image unique, trois cibles.
#
#  Le monorepo s'installe une fois : les trois applications partagent
#  `packages/shared`, il serait absurde de le télécharger trois fois. Chaque
#  cible finale ne conserve ensuite que ce dont elle a besoin.
# ═══════════════════════════════════════════════════════════════════════════

# ── Socle commun : dépendances du monorepo ────────────────────────────────
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/
COPY apps/menu/package.json ./apps/menu/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY e2e/package.json ./e2e/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── Compilation ───────────────────────────────────────────────────────────
FROM deps AS build
ARG VITE_API_URL=http://localhost:3010
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN pnpm --filter @evolyx/shared build \
 && pnpm --filter @evolyx/api db:generate \
 && pnpm --filter @evolyx/api build \
 && pnpm --filter @evolyx/admin build \
 && pnpm --filter @evolyx/menu build

# ── API ───────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS api
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

RUN mkdir -p apps/api/storage && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]

# ── Fronts : statiques, servis par nginx ─────────────────────────────────
FROM nginx:1.27-alpine AS admin
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM nginx:1.27-alpine AS menu
COPY --from=build /app/apps/menu/dist /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
