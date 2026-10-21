# B4c Runbook — page polish

## What shipped
- Shared UI: `components/platform/ui/` (page header, empty state, confirm dialog)
- Formatters / status badges / action labels (from B4b + `action-labels.ts`)
- **Organizations** — search list polish; detail **Tabs** (Overview / Members / Billing / Overrides / Actions); Suspend confirm
- **Users** — page header polish
- **Packages** — Public / Internal / Archived tabs; money format
- **Credit prices** — friendly labels; single **Save all** + diff confirm
- **Top-ups** — create / grant dialogs; org search; archive confirm
- **Invoices** — table + per-row Mark paid / Set URL dialogs
- **Audit** — action presets; plain-language labels; expandable diffs
- **Payments** — confirm dialog password scoped at confirm-time (not stale)
- **Settings → 2FA** — QR code + copy secret + download recovery codes
- Deps: `qrcode.react`

## Deploy
```bash
cd /var/www/html/sales
git pull
npm install
npm run build
pm2 restart sales
```

## Verify
1. Org detail tabs switch cleanly; Suspend asks to confirm.
2. Packages tabs filter Public vs Internal.
3. Credit prices: edit two rows → Save all shows diff → saves.
4. Top-ups: Grant finds org by name (not UUID).
5. Invoices: Mark paid opens dialog with reason.
6. Settings 2FA: QR appears after Start setup.
7. Payments master switch: type password **in the dialog** → works.

## B4 complete when
B4a + B4b + B4c verified on prod. Next work is outside B4 (Phase 6 / Live providers / tenant UI) only with a new GO.
