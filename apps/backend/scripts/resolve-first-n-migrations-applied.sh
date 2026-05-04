#!/bin/sh
# Baseline при ошибке P3005 (БД не пустая, но в _prisma_migrations нет записей / не совпадает).
#
# Укажите N = сколько ПЕРВЫХ миграций (по имени папки, сортировка как ls) уже реально применены к БД.
# Пример: схема совпадает со всеми миграциями кроме клиентской (последняя папка) → N=6
#
# Запуск в Docker:
#   docker compose exec backend sh /app/apps/backend/scripts/resolve-first-n-migrations-applied.sh 6
#
# Локально (из хоста, с DATABASE_URL):
#   cd apps/backend && sh scripts/resolve-first-n-migrations-applied.sh 6
#
set -e
N="${1:?Usage: $0 <N> — number of earliest migration folders to mark as applied without running SQL}"
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$BACKEND/../.." && pwd)"
PRISMA_CLI="$(find "$ROOT" -type f -path '*/node_modules/prisma/build/index.js' 2>/dev/null | head -n 1)"
if [ -z "$PRISMA_CLI" ] || [ ! -f "$PRISMA_CLI" ]; then
  echo "Prisma CLI not found under $ROOT" >&2
  exit 1
fi
cd "$BACKEND"
i=0
for d in $(ls -1 prisma/migrations | sort); do
  [ -f "prisma/migrations/$d/migration.sql" ] || continue
  i=$((i + 1))
  [ "$i" -le "$N" ] || break
  echo "migrate resolve --applied $d"
  node "$PRISMA_CLI" migrate resolve --applied "$d"
done
echo "migrate deploy"
node "$PRISMA_CLI" migrate deploy
