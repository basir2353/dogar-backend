#!/usr/bin/env sh
set -eu

echo "[deploy] Checking required environment..."
node scripts/check-deploy-env.js

echo "[deploy] Running Prisma migrations..."
npx prisma migrate deploy

echo "[deploy] Starting API..."
exec node dist/server.js
