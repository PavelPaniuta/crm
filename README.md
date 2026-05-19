# biscrm

Working CRM (admin/manager) with multi-business (multi-tenant) support.

## Quick start (local)

1. Install deps:

```bash
npm install
```

2. Start DB + apps:

```bash
docker compose up -d
```

3. DB migrations + seed (локально):

```bash
npm run db:migrate:dev -w @biscrm/backend
# или для быстрого прототипа без файла миграции: npm run db:push -w @biscrm/backend
npm run db:seed -w @biscrm/backend
```

4. Tests (backend payout math):

```bash
npm test
```

5. Run dev:

```bash
npm run dev
```
