#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Seeding (idempotent)..."
npx tsx prisma/seed.ts || true
echo "Starting Next.js..."
exec npx next start -H 0.0.0.0 -p 3000
