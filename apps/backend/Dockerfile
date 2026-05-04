FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/backend ./apps/backend

WORKDIR /app
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# CLI Prisma 6.x только из установленного tree (npm workspaces кладёт пакет в разные вложенности).
# Не использовать npx/npm exec prisma — тянут prisma@7.
RUN set -e; \
  PRISMA_JS="$(find . -type f -path '*/node_modules/prisma/build/index.js' 2>/dev/null | head -n 1)"; \
  if [ -z "$PRISMA_JS" ] || [ ! -f "$PRISMA_JS" ]; then \
    echo "Prisma CLI not found (expected */node_modules/prisma/build/index.js)" >&2; \
    find . -maxdepth 5 -type d -name prisma 2>/dev/null | head -40 >&2 || true; \
    exit 1; \
  fi; \
  echo "Using $PRISMA_JS"; \
  node "$PRISMA_JS" generate --schema apps/backend/prisma/schema.prisma

# Build Nest
RUN npm run build -w @biscrm/backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/scripts ./apps/backend/scripts
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
