<<<<<<< HEAD
# crm
=======
# biscrm

Working CRM (admin/manager) with multi-business (multi-tenant) support.

## Quick start (local)

1. Install deps:

```bash
npm install
```

2. Start DB + apps (will be added in `docker-compose.yml`):

```bash
docker compose up -d
```

3. Run migrations + seed (will be added):

```bash
npm run db:migrate -w @biscrm/backend
npm run db:seed -w @biscrm/backend
```

4. Run dev:

```bash
npm run dev
```

>>>>>>> ef17deb (init)
