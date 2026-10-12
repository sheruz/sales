# Cron setup (pm2 host: `/var/www/html/sales`)

Autopilot crawls + enrichment depend on `POST /api/cron/automation` every 5 minutes.

## 1. Ensure env

In `/var/www/html/sales/.env`:

```env
CRON_SECRET=generate-a-long-random-string
APP_URL=https://your-domain.com
```

`CRON_SECRET` is **required** in production.

## 2. Install tick script

```bash
cd /var/www/html/sales
chmod 700 scripts/cron-tick.sh
sudo touch /var/log/sales-cron.log
sudo chown "$(whoami)" /var/log/sales-cron.log
sudo mkdir -p /var/lock
```

Manual test:

```bash
/var/www/html/sales/scripts/cron-tick.sh
tail -n 20 /var/log/sales-cron.log
```

You should see `HTTP 200`. Autopilot page **Last cron run** should update.

## 3. Crontab (with flock)

```bash
crontab -e
```

Add:

```cron
*/5 * * * * /usr/bin/flock -n /var/lock/sales-cron.crontab.lock /var/www/html/sales/scripts/cron-tick.sh
```

Do **not** put `CRON_SECRET` in crontab — the script reads it from `.env`.

## 4. Logrotate (optional; script also size-caps at 5MB)

```bash
sudo tee /etc/logrotate.d/sales-cron >/dev/null <<'EOF'
/var/log/sales-cron.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
```

## 5. Overlap protection

1. **flock** in crontab + script — OS-level  
2. **Postgres advisory lock** inside `/api/cron/automation` — DB-level  

If a tick is still running, the next one exits immediately (`advisory_lock_held` / `SKIP lock held`).

## 6. Autopilot UI

- Warning if last cron &gt; 15 minutes  
- **Auto-crawl** (default ON) drains PENDING website crawls even when Places **Sourcing OFF**  
- **Enrichment** toggle is separate (default OFF)
