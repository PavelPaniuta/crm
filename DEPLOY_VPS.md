## Deploy BisCRM to Ubuntu VPS (my-crm.live)

### Обновление уже запущенного сервера

Если сервер уже работает и нужно накатить новые изменения:

```bash
cd ~/crm
git pull

# Обновить схему БД (ОБЯЗАТЕЛЬНО перед рестартом если менялась Prisma схема)
docker compose exec backend sh -lc "npx prisma@6 db push --schema /app/apps/backend/prisma/schema.prisma"

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

### 4) Create tables + seed admin user

```bash
docker compose exec backend sh -lc "npm run db:generate && npm run db:push && npm run build && node dist/seed.js"
```

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

