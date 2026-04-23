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

3. Push DB schema + seed:

```bash
npm run db:push -w @biscrm/backend
npm run db:seed -w @biscrm/backend
```

4. Run dev:

```bash
npm run dev
```
