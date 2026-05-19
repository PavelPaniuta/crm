## Deploy BisCRM to Ubuntu VPS (my-crm.live)

### Обновление уже запущенного сервера

Если сервер уже работает и нужно накатить новые изменения:

```bash
cd ~/crm
git pull

# Схема БД — только если в pull есть новые папки в apps/backend/prisma/migrations/
# (не использовать db push / migrate reset на проде — см. .cursor/rules/database-safety.mdc)
# docker compose exec db pg_dump -U biscrm biscrm > backup_$(date +%Y%m%d_%H%M).sql
docker compose exec backend npx prisma migrate deploy

# Пересобрать и перезапустить только изменённые сервисы
docker compose build --parallel backend web
docker compose up -d backend web nginx
```

---

## Первичный деплой

### 0) DNS
- Create A record: `my-crm.live` → your VPS IP
- (Optional) `www.my-crm.live` → same IP (only if you want www)

### 1) Install Docker

```bash
sudo apt update -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update -y
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2) Get code
- Option A: `git clone ...`
- Option B: upload folder and `cd` into it

### 3) Build and start services

```bash
docker compose up -d --build db backend web nginx
```

### 4) Apply migrations + seed admin user

Из каталога `~/crm` (где лежит `docker-compose.yml`):

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/seed.js
```

Если seed ещё не собран в образе, один раз после первого `up`:

```bash
docker compose exec backend sh -lc "npm run db:generate && npm run build && node dist/seed.js"
```

**Не использовать на проде:** `prisma db push`, `migrate reset`, `docker compose down -v` — см. `.cursor/rules/database-safety.mdc`.

### 4b) Прод поднимали раньше через `db push`?

При ошибке **P3005** на `migrate deploy` — сначала бэкап, затем baseline (подставьте число миграций, уже отражённых в БД):

```bash
docker compose exec db pg_dump -U biscrm biscrm > backup_$(date +%Y%m%d_%H%M).sql
docker compose exec backend sh /app/apps/backend/scripts/resolve-first-n-migrations-applied.sh 8
```

Список папок: `ls apps/backend/prisma/migrations` на сервере после `git pull`.

Default credentials:
- login: `admin`
- pass: `admin123`

### 5) Enable SSL (Let’s Encrypt)

Install certbot:

```bash
sudo apt install -y certbot
```

Request cert:

```bash
sudo certbot certonly --webroot \
  -w $(pwd)/docker-data/certbot/www \
  -d my-crm.live \
  --email you@example.com --agree-tos --no-eff-email
```

Then restart nginx:

```bash
docker compose restart nginx
```

