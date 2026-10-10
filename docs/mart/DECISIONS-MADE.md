# Vocksy Mart — Decisions Made

Log of choices made during the build that weren't spelled out in the handoff package, or that were confirmed with Vikum along the way. Newest first.

---

## 2026-10-10 — Milestone 1 Step 1.4: Detail screen (mobile)

- **Share actually works (native `Share.share`, no backend); Favorite, Report, Message
  Seller, Edit, Mark Sold and the seller-row tap all show "Coming soon."** Same rule as
  every step since 1.3: never fake a button that looks functional when nothing real is
  behind it yet (Favorites persistence is 1.7, Chat is 1.8, Edit/Mark Sold is 1.5, Report
  is 3.1, Seller profile is 2.7).
- **A successful Post Ad now replaces the `postAd` stack entry with `detail`** (not a
  push on top of it) so Back from the brand-new ad's Detail page lands on Home, not back
  inside the just-submitted form — matches §2's "Exit: ... success → the new ad's
  Detail" without leaving a dead form screen in the back stack.
- **Similar Parts strip reuses the existing `MartListingCard`** inside a fixed 128px-wide
  wrapper, instead of a new dedicated small-card component — the card's own `flex: 1`
  already adapts to whatever width it's given.

---

## 2026-10-10 — Milestone 1 Step 1.4: Detail + similar (backend)

- **`offersCount`/`newOffersCount` (wanted, owner-only) and `deal.canRate` return
  placeholder values (`0`/`0`/`false`) for now**, same treatment and same reasoning as
  Step 1.1's `unreadThreads`: the real logic needs either data that can't exist yet (no
  Offers UI until Milestone 2 Step 2.2, no Ratings until 2.5) or a cross-row "unread"
  comparison Prisma can't express cleanly. Each has a comment pointing at the step where
  the real version belongs.
- **`buildListingCards()` (the feed's enrichment logic) extracted into a shared, exported
  function** so `/similar` and `/more-from-seller` reuse it instead of duplicating the
  seller-tag/rating/favorites batching — keeps the "no N+1" rule true across all three
  new routes without three separate implementations to keep in sync.
- **`/more-from-seller` only ever shows the seller's Selling ads**, reusing the exact
  "active ads = selling only" interpretation already logged for `getActiveAdsCounts`
  (Step 0.6) — a Wanted request from the same person doesn't count as one of their "ads"
  here either, for the same reason.

---

## 2026-10-10 — Milestone 1 Step 1.3: Mart Home + Filters (mobile) + a navigation gap closed

- **`MartNavigator` graduates from dev-preview-only to real navigation**: `'home'` now
  renders the real `MartHomeScreen`, with real `push('filters')`/`push('postAd')` stack
  entries. This is the natural point for that switch — Mart Home is the feature's actual
  front door, which is what Step 0.11 built the stack machinery for in the first place.
  `MartDevPreviewScreen` stays in the repo but is no longer referenced from here.
- **Closed a real gap from Step 0.11**: the bottom tab bar is supposed to hide during
  Mart's full-screen flows (Posting, Filters, Detail, Chat — `04-screens.md` §0.2), but
  App.tsx's tab-bar visibility only ever checked the top-level `screen` value (always
  `'mart'` regardless of what's happening inside `MartNavigator`'s own stack). Fixed with
  a small additive callback (`MartNavigator`'s new `onFullScreenChange` prop) rather than
  restructuring App.tsx's screen model — App.tsx's existing tab-bar render gained one
  extra guard condition, nothing else changed.
- **Favorites heart / card tap / 4 header icons (Favorites, Messages, Notifications, My
  Mart) show a plain "Coming soon" alert**, not a disabled/grayed-out control and not a
  faked local-only toggle. A fake-but-working-looking favorite heart would silently lose
  the "favorite" on the next refresh (no real persistence exists until Step 1.7) — judged
  more honest to say nothing works there yet than to look like it does.
- **Posting pops back to Mart Home (which naturally refetches) with a plain success
  alert**, instead of navigating to the new ad's Detail page — Detail doesn't exist until
  Step 1.4.

---

## 2026-10-10 — Milestone 1 Step 1.3: Feed + filters (backend)

- **`buildListingsWhere()`'s Wanted branch (budget overlap, `budgetMax` sort) is written
  correctly per `03-api.md` §4 but tested only lightly**, same treatment as Step 1.2's
  create validation — Wanted browsing isn't reachable from the app until Milestone 2 Step
  2.1, so there's no real caller to exercise it against yet.
- **`GET /mart/listings/count` registered before any future `/:listingId`** (Step 1.4) —
  a one-line placement decision now, so whoever adds the single-listing route later
  doesn't accidentally register it first and have Express treat the literal string
  "count" as a listing id.
- **Category-keyword search matching checks only the top-level category's own `en`/
  `keywords` fields**, not its nested types' keywords — matches `03-api.md` §4's literal
  wording ("the label/keywords of the category... which maps to categoryId").

---

## 2026-10-10 — Milestone 1 Step 1.2: Post ad (mobile) + a package-internal contradiction resolved

- **Resolved a contradiction in the handoff package itself: Mart mobile text stays plain
  English (no i18n keys) through Milestone 1 and 2, added only at Step 3.7.** The build
  plan's own "Rules for the whole build" section says to "add every user-facing string as
  an i18n key (en) from Milestone 1; step 3.7 only adds si/ta text" — but Step 3.7's own
  row in the same table describes its own deliverable as "i18n keys for all Mart text;
  English fallback," which only makes sense if the keys don't already exist before then.
  Treated 3.7's specific, later-listed description as the one that wins, the same way
  `04-screens.md` §23 already explicitly overrides its own earlier sections — rather than
  stopping to ask, since this is exactly the kind of build-time judgment call the package
  asks the developer to make and log. Every Mart string built so far (Step 1.1's pickers/
  sheet/rules screen, Step 1.2's Post Ad form) uses plain English, consistent with this.
- **Post Ad screen posts Selling only** — no Selling/Wanted segmented control. Wanted
  posting is Milestone 2 Step 2.1; the control has nothing meaningful to disable yet
  (there's no Wanted form behind it at all), so it's simply not rendered rather than shown
  disabled.
- **One "Compatible Vehicle" row opens the full Step 1.1 vehicle picker as a single unit**,
  not 3 separate Make / Model / Year rows as the mockup's literal layout shows — reuses the
  already-built 3-step component outright; the spec itself calls this area a build-time
  decision to confirm.
- **Photo source choice (camera vs. gallery) is a plain `Alert.alert` action sheet**, not a
  custom UI — cheapest way to satisfy "multi-select from gallery or camera." Gallery supports
  `allowsMultipleSelection`; camera is always a single shot (a camera can't multi-select).
- **"Can arrange delivery" reuses the existing native `Switch`** (same component
  `NotificationPrefsScreen` already uses) rather than a new pixel-matched 42×24 toggle.
- **No auto-scroll-to-first-error on submit** — inline red text under each invalid field is
  built, but scrolling the view to the first error would need per-field layout measurement
  across a 10-field form; judged not worth the complexity for a first pass. Can add later
  if it's actually missed in use.
- **`api.uploadPhoto()` gained an optional 3rd parameter (`folder?: string`)** instead of a
  new function, since it's the exact same upload mechanics either way — confirmed all 6
  existing call sites still pass only 2 arguments, so nothing about their behavior changes.

---

## 2026-10-10 — Milestone 1 Step 1.2: Post ad (backend)

- **`POST /mart/listings` validates both `selling` and `wanted` bodies now**, even though
  the build plan scopes this step's mobile screen to Selling only (Wanted posting is
  Milestone 2 Step 2.1). `03-api.md` §4 already documents one endpoint contract for both
  types, and the wanted-specific rules (budget, optional make) are fully specified in
  `02-data-model.md` §4.1 today — writing them once now avoids reopening this file later
  to retrofit rules that don't need any new information to implement. The mobile Post Ad
  screen in this step only ever sends `type: "selling"`.
- **`validateListingCreate()` takes `r2PublicUrl` as a parameter, not read from
  `process.env` internally** — same reasoning as `me.ts`'s exported pure functions: keeps
  it callable from a standalone verification script with no server/env setup needed.

---

## 2026-10-10 — Milestone 1 Step 1.1: pickers, gate sheet, rules screen (mobile)

- **Vehicle picker returns `{make, model, yearFrom, yearTo}` using the already-shared
  `mobile/src/constants/vehicleData.ts` (`BRAND_MODELS`/`BRANDS_LIST`)**, not a separate Mart
  copy — that file was already shared app-wide before Mart existed (Add Vehicle uses it
  too), and `vehicleCatalog.ts` (backend) is its server-side twin per Step 0.7. No new
  constant needed.
- **Category picker returns `{categoryId, categoryTypeId}`**, matching the `MartListing`
  Prisma field names exactly (not `typeId`, which §21.1's prose uses loosely) — per §23
  point 9's correction that the data-model field names win.
- **Pickers, the name+district sheet and the Mart rules screen were built as standalone,
  reusable components but deliberately NOT wired into `MartNavigator`'s push/pop stack
  yet.** None has a real caller until Step 1.2 (Post ad) and Step 1.8 (Chat) — wiring
  `push()` params now would mean guessing a shape before any real caller's needs are known.
  Reachable only from `MartDevPreviewScreen` for now, same bridge Step 0.10's components
  used before Step 0.11 gave them real navigation. Will wire for real at Step 1.2.
- **Name+district sheet opens the District picker as a second, ad-hoc `Modal`**, not a push
  onto the sheet's own stack — the picker is specified as full-screen, which can't render
  inside a bottom sheet's rounded card. Two sibling Modals stacking visually works fine in
  RN; this also means `DistrictPickerScreen` stays a plain full-screen `View` (no `Modal` of
  its own), so it still works unmodified when `MartNavigator` eventually pushes it directly.
- **`MartRulesScreen` built with both `firstAction` and `readOnly` modes now**, even though
  `readOnly` (My Mart > Mart rules) has no caller yet (My Mart doesn't exist until a later
  milestone) — the extra mode was zero additional design work since the screen's body is
  identical either way, only the bottom checkbox bar differs.

---

## 2026-10-10 — Milestone 1 Step 1.1: Mart profile (backend)

- **`unreadThreads` in `GET /mart/me` returns `0` for now**, not a real computed count. The correct logic needs `lastMessageAt > myReadAt`, where `myReadAt` is `ownerReadAt` or `otherReadAt` depending on which role I have in that specific thread — Prisma can't compare two columns of the same row in a plain `where` filter, and there's no Chat UI yet to verify such a query against real data anyway. Deferred to Milestone 1 Step 1.8 (Chat), where the real messaging query layer gets designed together with proper test coverage.
- **`POST /mart/rules/accept` lives in its own file** (`routes/mart/rules.ts`), mounted at `/mart/rules/accept` directly — not nested inside `me.ts`'s router, which would have put it at the wrong path (`/mart/me/rules/accept`). Caught before testing.

---

## 2026-10-09 — Step 0.10: shared mobile components

- **Added a new `priceSmall` theme token** to `colors.ts` (light `#b97f00`, dark same as `accent`) for list-row prices, per the spec's own §0.1 distinction between "big text" and "small text" price colors, and §0.1b's rule to add a token rather than hard-code when one doesn't exist.
- **`MartPhotoViewer` was extracted from an existing pattern**, not built from scratch — the exact same `Modal` + paging `FlatList` approach already duplicated 3 times (`VehicleDashboardScreen`, `BookingScreen`, `VehicleHistoryScreen`). No new dependency (no pinch-zoom library) added, matching what the app already does despite the spec's looser wording ("swipe, pinch").
- **`MartDevPreviewScreen` is built but deliberately not wired into navigation** — making it reachable is Step 0.11's job (the new nav stack), not 0.10's. Sits ready, unreachable, until then.
- **`MartListingRow` is one shared component for both Favorites and My Ads rows** (same core shape per §7/§10), with a `footer` slot for each screen's own extra buttons/stats, rather than two near-duplicate components.

---

## 2026-10-08 — IMPORTANT lesson: never run `npm run dev` / the full server locally against production for a quick test

Starting the backend locally (to test one new route) also started every background job (`startRenewalReminderJob`, `startServiceNotificationJob`, `startBookingReminderJob`, `startMileageReminderJob`) — each one runs its check **once immediately on startup**, not just on its schedule. Since local `.env` points at the real production database, this ran real reminder logic against real data for the ~20 seconds the server was up, before being noticed and killed. **Checked the next day: confirmed zero notifications were created in that window** (queried `AppNotification` directly) — genuinely no impact, not just a low-risk guess. Still avoidable entirely. **Going forward: never start the full `index.ts`/`npm run dev` against the production database for a one-off test.** If a live HTTP-level test is ever truly needed, build a minimal standalone Express app in the test script that mounts only the specific middleware/route being tested — never import the real `index.ts`, which brings the jobs with it. See `docs/mart/checks/0.9.md` for the full incident.

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
