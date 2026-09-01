#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning stale artifacts..."
rm -rf node_modules .next

echo "==> Installing dependencies for Linux..."
npm install --include=optional

echo "==> Verifying Tailwind native binding..."
node scripts/ensure-tailwind-oxide.js

echo "==> Building application..."
npm run build

echo "==> Done. Start with: npm start"
