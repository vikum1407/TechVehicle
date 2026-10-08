# Vocksy Mart — Decisions Made

Log of choices made during the build that weren't spelled out in the handoff package, or that were confirmed with Vikum along the way. Newest first.

---

## 2026-10-08 — IMPORTANT lesson: never run `npm run dev` / the full server locally against production for a quick test

Starting the backend locally (to test one new route) also started every background job (`startRenewalReminderJob`, `startServiceNotificationJob`, `startBookingReminderJob`, `startMileageReminderJob`) — each one runs its check **once immediately on startup**, not just on its schedule. Since local `.env` points at the real production database, this ran real reminder logic against real data for the ~20 seconds the server was up, before being noticed and killed. Likely low-impact (every job has an "already sent today" guard field that would prevent an actual duplicate), but avoidable entirely. **Going forward: never start the full `index.ts`/`npm run dev` against the production database for a one-off test.** If a live HTTP-level test is ever truly needed, build a minimal standalone Express app in the test script that mounts only the specific middleware/route being tested — never import the real `index.ts`, which brings the jobs with it. See `docs/mart/checks/0.9.md` for the full incident.

---

## 2026-10-08 — Step 0.6 (deferred helpers): sellerInfo.ts

- **`getActiveAdsCounts()` counts selling ads only** (available/reserved), not wanted requests. The spec's own wording for "active ads count" doesn't say this explicitly, but both real usages of it (`04-screens.md` §3 Detail seller row, §16 Seller Profile "Ads N" tab) only ever mean selling ads — the Ads tab explicitly excludes wanted requests.

---

## 2026-10-08 — Step 0.7: constants

- **Sinhala and Tamil labels** written for all 25 districts and 12 categories (standard administrative/automotive terms) as a first pass — **needs a native-speaker review before launch**, per the package's own stated process (developer drafts, Vikum corrects, Sinhala first).
- **Category search keywords**: reasonable first-pass list per type (plain English terms + a few known misspellings, e.g. "break" for "brake") — not exhaustive, can grow later from real search data.
- **"Micro" model list** (Panda, MX7, Geely Flyer, Geely CK) added to `vehicleData.ts`/`vehicleCatalog.ts` — lower confidence than the major brands since Micro is a smaller, less-documented Sri Lankan brand. Worth Vikum confirming the current lineup is accurate.
- Confirmed **7 of the spec's 8 "extra makes" were already in `vehicleData.ts`** (Daihatsu, Tata, Mahindra, Kia, Hyundai, BMW, Mercedes-Benz) — only "Micro" needed adding, so this was a much smaller edit to that existing file than the spec implied.

---

## 2026-10-08 — Step 0.6: helpers

- **`sellerInfo.ts` and `blockedSet.ts` deferred to right after Step 0.8.** Both need Mart database tables (`MartListing`, `MartSellerRating`, `MartBlock`, `MartFollow`) that don't exist yet — the build plan lists 0.6 before 0.8 even though these two specific files depend on it. Built the 5 schema-independent helpers now (`vehicleText.ts`, `pagination.ts`, `publicName.ts`, `martLimits.ts`, mobile `martHelpers.ts`); the other two wait until the schema is pushed.
- **Mart's `timeAgo()` reuses the existing `notifications.*` i18n keys** (`justNow`, `minsAgo`, `hoursAgo`, `yesterday`, `daysAgo`) rather than adding duplicate Mart-specific ones — same wording, already translated into si/ta, caller prefixes it ("Posted ", "Reserved ", etc.).

---

## 2026-10-05 — Step 0.2b: daily backup job

- **GitHub Actions, not Render Cron.** Render's Cron Job service requires a paid plan; the project's own rule is $0 budget / no new paid service. GitHub Actions scheduled workflows are free and the repo already lives on GitHub. Confirmed with Vikum before building.
- **Separate private R2 bucket (`vocksy-backups`)**, not the existing `techvehicle-photos` bucket. The photos bucket has public read access (needed for the app to serve images); a database dump contains real names/phones/emails and must never be reachable by a public URL.
- **Secret names (GitHub repo secrets):** `NEON_DIRECT_URL` (direct, non-pooled, for `pg_dump`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET_NAME`. The R2 credentials are a dedicated API token (`vocksy-backups-token`), Object Read & Write, scoped to just the `vocksy-backups` bucket — not the app's existing all-buckets token.
- **Backup key layout:** `db-backups/vocksy_backup_<YYYY-MM-DD>.dump`, custom-format (`pg_dump -Fc`), keep the last 14 by `LastModified`.
- **Script location:** `backend/src/scripts/dbBackupToR2.ts`, run via `npx ts-node` (matches the existing `deleteAccount.ts` convention). Schedule: `.github/workflows/db-backup.yml`, cron `30 20 * * *` (2 AM Sri Lanka time) + `workflow_dispatch` for manual testing.
- **This one script + workflow were merged to `main` ahead of any Mart milestone**, as a deliberate exception to "only merge at a milestone." Reason: both GitHub's scheduled triggers and the manual "Run workflow" button only work from files present on the default branch — there was no way to make the job actually functional otherwise. Verified before merging that the commit touches zero existing files and nothing in the running server imports or calls the new script, so the Render redeploy this triggered was behaviorally a no-op.
- **Two build-time bugs fixed, both isolated to the new files only** (neither touched shared config):
  1. `TS2591` in CI (`Cannot find name 'process'` etc.) — GitHub Actions' `npm ci` didn't make the script's ambient Node types available the way local `ts-node` did. Fixed with `/// <reference types="node" />` at the top of the script, not by editing the shared `tsconfig.json`.
  2. `pg_dump` version mismatch in CI — Ubuntu's default `postgresql-client` (v16) was ahead of the newly `apt`-installed v18 on `PATH`. Fixed by prepending `/usr/lib/postgresql/18/bin` to `$GITHUB_PATH` in the workflow, same root cause as the local Windows version-mismatch during the manual backup test.

## 2026-10-05 — Step 0.2a: manual production backup

- Used the Neon **direct** (non-pooled) connection for `pg_dump`, not the pooled one the app uses — Neon recommends this for dump reliability.
- Local `pg_dump`/`pg_restore` needed to be upgraded to v18 to match the Neon server version (16 is too old; `pg_dump` refuses to dump a newer server).
- Verified the dump restores correctly by creating a throwaway Neon project, restoring into it, confirming real row counts (`User` count = 31), then deleting the throwaway project.
