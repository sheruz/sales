# Backlog — lighter polish (from B4c)

Tracked after B5. Not in Phase 6 / Paddle Live.

## Super Admin UI

- **Org detail Actions menu redesign** — clearer grouping for lifecycle / billing / support actions on `platform/companies/[id]`.
- **Users → Platform-admins tab** — dedicated list of SUPER_ADMIN / PLATFORM_SUPPORT with enrollment and role filters.
- **Audit org/actor typeahead** — searchable org + actor pickers on `/platform/audit` instead of raw IDs.
- **Invoices detail drawer (Sheet)** — open invoice line items / payments without leaving the list.
- **Transactions tax column + Select filters** — show tax amount; filter by kind / provider / environment with Select controls.

## Notes

- Prefer small PRs per item.
- Keep Delvix / tenant outbound isolation intact when touching email or branding surfaces.
