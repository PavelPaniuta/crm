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
# Исходники с хоста без node_modules — перезаписывают apps/backend и УДАЛЯют prisma из deps.
COPY apps/backend ./apps/backend
# Вернуть workspace-зависимости бэкенда (lockfile: apps/backend/node_modules/prisma).
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

WORKDIR /app
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# Только Prisma 6.x из node_modules (не npx — иначе prisma@7).
RUN node apps/backend/node_modules/prisma/build/index.js generate --schema apps/backend/prisma/schema.prisma

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
