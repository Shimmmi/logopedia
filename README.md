# LogoPed.site

ИИ-платформа учителя-логопеда. Стек: Next.js 14, Prisma, PostgreSQL, Redis, BullMQ.

## Запуск

1. Заполните `.env` (минимум `AI_API_KEY` от [RouterAI](https://routerai.ru) для генерации документов).
2. `mkdir -p /var/www/logoped/storage`
3. `docker compose up -d --build`
4. Nginx: см. [deploy/README.md](deploy/README.md)

Без SMTP код подтверждения email показывается на экране (`DEV_SHOW_CODES=true`).
Без ЮKassa тариф можно переключить вручную в Настройках (dev).
