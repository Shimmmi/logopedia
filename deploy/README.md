# Деплой logoped.site

Текущий прод-режим на этом VPS:
- PostgreSQL и Redis — Docker Compose (`docker compose up -d postgres redis`)
- Приложение и воркер — systemd: `logoped-app`, `logoped-worker` (порт 127.0.0.1:8030)
- Nginx + Let's Encrypt: `/etc/nginx/sites-enabled/logoped`

Полный Docker-стек (app+worker в контейнерах) собирается `docker compose up -d --build`.

1. Заполнить `/opt/Logoped/.env` (для ИИ — `AI_API_KEY` RouterAI).
2. `mkdir -p /var/www/logoped/storage`
3. `systemctl restart logoped-app logoped-worker`

