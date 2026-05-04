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

# Локальный CLI из node_modules (6.x). npm exec/npx без пути на Docker часто качают prisma@7.
RUN set -e; \
  if [ -f node_modules/prisma/build/index.js ]; then \
    node node_modules/prisma/build/index.js generate --schema apps/backend/prisma/schema.prisma; \
  elif [ -f apps/backend/node_modules/prisma/build/index.js ]; then \
    node apps/backend/node_modules/prisma/build/index.js generate --schema apps/backend/prisma/schema.prisma; \
  else \
    echo "Prisma CLI not found after npm ci" >&2; \
    ls -la node_modules/prisma 2>/dev/null || true; \
    ls -la apps/backend/node_modules/prisma 2>/dev/null || true; \
    exit 1; \
  fi

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
