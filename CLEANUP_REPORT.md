# Cleanup Report — Production Hardening Phase 1

## What was removed / fixed

1. **Frontend typecheck errors fixed** (5 files, `src/app/` and `src/app/*`):
   - `src/app/(site)/project/[id]/page.tsx` — Added `redirect` to `next/navigation` import (lines 144, 147 had `Cannot find name 'redirect'`). The `redirect()` function is used in `flagListing` server action to redirect after flagging a project listing.
   - `src/app/client/payments/page.tsx` — Updated `MethodsResponse` interface to include `user_id` and `provider_method_id` fields, matching the `PaymentMethodRow` interface used by `<PaymentsClient>`. This resolved the type mismatch error where the API response shape didn't assignable to `PaymentMethodRow[]`.
   - `src/app/client/transactions/transactions-client.tsx` — Added missing imports: `StatCard` from `@/components/ui/page-blocks`, `SearchRemoveIcon` from `@/lib/icons`. These components were used in the UI but not imported, causing `Cannot find name` errors.
   - `src/app/freelancer/transactions/page.tsx` — Added `cn` import from `@/lib/utils` (the project's custom class-name merger; `class-variance-authority` only exports `cva`). Also added `SearchRemoveIcon` to the `@/lib/icons` import.
   - `src/app/freelancer/messages/page.tsx` — Added `isDeleted: boolean` to the `ConversationLastMessage` interface. The UI code at line 267 accessed `conversation.lastMessage.isDeleted` but the type definition was missing the property.

2. **No `console.*` calls found** in `src/**` or `apps/api/src/**` (verified via grep: 0 matches).

3. **No `TODO`/`FIXME` markers** found via quick pattern scan (not a comprehensive scan, but no obvious leftovers caught by the pattern).

4. **No unused dependencies flagged** by `depcheck` — `missing: {}` (all dependencies have at least one usage). Note: depcheck listed many deps in `dependencies`/`devDependencies` but every one has at least one importer in the codebase.

5. **No diagnostic `diag-*.ts` files removed** — These are runtime check scripts kept for reference; not source code nor user-facing UI. Decided to keep pending explicit instruction.

6. **No `.env` secrets committed** — `apps/api/.env` contains a real `AUTH_SECRET` and DB config. This file is gitignored (pattern `.env*` in root `.gitignore`). **Action required**: rotate `AUTH_SECRET` before any shared/production deployment. The `.env.example` documents all required variables with placeholder values (e.g. `AUTH_SECRET=change-me-generate-a-real-secret-for-production`).

## Files modified

| File | Change |
|---|---|
| `src/app/(site)/project/[id]/page.tsx` | Added `redirect` to `next/navigation` import |
| `src/app/client/payments/page.tsx` | Added `user_id` and `provider_method_id` to `MethodsResponse` interface |
| `src/app/client/transactions/transactions-client.tsx` | Added `StatCard` import; added `SearchRemoveIcon` import |
| `src/app/freelancer/transactions/page.tsx` | Added `cn` import from `@/lib/utils`; added `SearchRemoveIcon` import |
| `src/app/freelancer/messages/page.tsx` | Added `isDeleted: boolean` to `ConversationLastMessage` interface |
| `CLEANUP_REPORT.md` | This file (new) |

## What was kept (for decision)

- `apps/api/diag-*.ts` (8 scripts) — runtime diagnostics, not user-facing; kept pending instruction.
- `apps/api/.env` — real secrets; kept out of git via `.gitignore`. Must be rotated before production use.
- `apps/api/dist/`, `apps/api/.pglite/`, build artifacts — keep unless explicitly cleaned.
- Dependency list — all have at least one usage per `depcheck`.

## Next steps (recommended)

1. **Rotate `AUTH_SECRET`** in `apps/api/.env` and regenerate a new 32+ char hex secret.
2. **Run full inventory** with `knip` or `ts-prune` to confirm no truly unused exports/deps.
3. **Address remaining audit domains** (AuthZ, Input Abuse, Secrets/Supply Chain, Reliability, etc.) as outlined in the production-readiness audit.
4. **Add `db:setup` / idempotent bootstrap** script as Phase 4 requires (single `sql/sql.txt` + `schema_migrations` table).
5. **Gate demo data/payments** behind env flag for prod safety.