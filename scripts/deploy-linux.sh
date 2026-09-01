#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning stale artifacts..."
rm -rf node_modules .next

echo "==> Installing dependencies..."
npm install --include=optional

echo "==> Tailwind native binding (if needed)..."
npm run setup:tailwind || true

echo "==> Prisma generate (requires .env)..."
npm run setup:generate

echo "==> Building application..."
npm run build

echo "==> Done. Start with: npm start"
