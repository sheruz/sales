# PoW1 — sales-audit-worker (install + pm2)

Browsers are **project-local**. They do **not** replace system Chrome and do **not** share a browser cache with other apps on the host.

## Why this does not affect other apps

| Setting | Effect |
|--------|--------|
| `PLAYWRIGHT_BROWSERS_PATH=0` | Chromium is stored under **this** repo’s `node_modules/.cache/ms-playwright` only |
| Separate pm2 process `sales-audit-worker` | Crash/OOM of the worker does not stop `sales` (Next) |
| Main app never launches Chromium | Request path only enqueues `DeepAuditJob` rows |

Do **not** set `PLAYWRIGHT_BROWSERS_PATH` to a shared global path used by another product.

## One-time install (on the sales host)

```bash
cd /var/www/html/sales   # or your sales-platform deploy path

# Optional: confirm you are in the sales app tree
pwd
ls package.json scripts/audit-worker.js

# Install Node deps (includes playwright package)
npm ci
# or: npm install

# Download Chromium for THIS project only
export PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install chromium

# OS libraries once (Debian/Ubuntu). Skip if chromium already launches.
# This installs shared libs; it does not overwrite another app’s browser binary.
# sudo npx playwright install-deps chromium
```

## Start / restart with pm2

```bash
cd /var/www/html/sales
export PLAYWRIGHT_BROWSERS_PATH=0

# First time — create the process
pm2 start scripts/audit-worker.js --name sales-audit-worker \
  --max-memory-restart 800M \
  --kill-timeout 10000 \
  --update-env

pm2 save

# After every PoW deploy (ONLY these two — never other apps / leen next-server):
pm2 restart sales sales-audit-worker
```

Verify:

```bash
pm2 list
pm2 logs sales-audit-worker --lines 50
# Expect: sales-audit-worker starting … playwrightPath=0
# Expect: browser job start … only on this process, never on `sales`
```

## Env (optional)

| Var | Default | Meaning |
|-----|---------|---------|
| `PLAYWRIGHT_BROWSERS_PATH` | `0` (set by worker) | Project-local browsers |
| `AUDIT_WORKER_POLL_MS` | `3000` | Queue poll interval |
| `AUDIT_WORKER_MEMORY_MB` | `750` | Skip new claims + kill orphans when RSS high |
| `AUDIT_EVIDENCE_DIR` | `storage/audit-evidence` | Private evidence root |

## DB migrate (before first enqueue)

```bash
# backup first, then:
DRY_RUN=1 npm run db:migrate:pow1-deep-audit
npm run db:migrate:pow1-deep-audit
npx prisma generate
```
