# Vocksy Mart — 05 Build Plan

Part of the developer package. Build in this order. Each step has a **Done when** check. Do not skip Step 0. Commit after each step (small commits, one step each). Work on a branch `feature/mart`; merge to main only at a milestone that has passed its check.

Rules for the whole build:
- Follow `02-data-model.md` for fields and `03-api.md` for endpoints. Screens: `04-screens.md` + `designs/chosen/`.
- Database changes are additive only. Take the backup in Step 0.2 **before** any `prisma db push`.
- Every new route goes under `/mart` behind `martGate`, so production users see nothing until the gate opens.
- No tests exist in the repo today. For each backend step, write a small script or a documented list of `curl` checks in `docs/mart/checks/<step>.md` and run it. Add real tests only if the project later adopts a runner.
- Add every user-facing string as an i18n key (en) from Milestone 1; step 3.7 only adds si/ta text. Hide or disable any entry point whose step is not built yet (for example the Report icon before 3.1, My Mart rows for Reviews/Followings/Blocked before their steps).
- If something is missing from the docs, choose the simplest option that follows the existing code conventions, and add one line to `docs/mart/DECISIONS-MADE.md` (what and why). Do not stop and ask.

---

## Step 0 — Prerequisites (before any Mart screen)

| # | Task | Done when |
|---|---|---|
| 0.1 | Create `docs/mart/` in the repo and copy this package + `designs/`. | Files in git |
| 0.2a | **Manual backup (required before 0.8):** `pg_dump` of production to R2 (or a safe place). | Dump file restores into a scratch DB |
| 0.2b | Daily `pg_dump` → R2 job (Render cron or GitHub Actions; keep the last 14). May finish by Milestone 3, but is a launch requirement. | Scheduled job ran once |
| 0.3 | `backend/src/utils/notificationPrefs.ts`: one shared parser/serializer with defaults for all keys incl. `garage_reminder`, `mart_message`, `mart_wanted`, `mart_rating`. Replace the 6 duplicated `parsePrefs()` copies. Fix `PUT /auth/notification-prefs` so it keeps `garage_reminder`. | Old prefs still read; saving prefs no longer drops `garage_reminder` |
| 0.4 | `sendPush`: read the Expo response; on `DeviceNotRegistered` set that user's `pushToken = null`. | Fake dead token gets cleared in a manual test |
| 0.5 | Env vars (server): `ADMIN_PHONES`, `MART_BETA_PHONES`, `MART_SUPPORT_WHATSAPP` (empty; returned by `/app-config`). Add to `.env.example` and Render. Mobile constant `STORE_URL` (Play Store link; if the app is not public yet use the current testing link or leave the share text without a link). | Present |
| 0.6 | Helpers: `backend/src/utils/vehicleText.ts` (`normalizeVehicleText`), `utils/pagination.ts` (cursor encode/decode, `limit` clamp), `utils/publicName.ts`, `utils/sellerInfo.ts` (`getSellerTags`, `getSellerRatings`, `getActiveAdsCounts`, batched per page), `utils/blockedSet.ts` (empty until `MartBlock` rows exist; call it in every feed, search, similar, thread and profile query from day one), `data/martLimits.ts`. Mobile: `formatLKR`, `timeAgo`, `openPhone`, `openWhatsApp`. | Unit-style scripts print expected output |
| 0.7 | Constants (02 §8): `martCategories`, `districts`, `vehicleCatalog` (backend), `martRules` on both sides. | Imports compile on both sides |
| 0.8 | Schema: add everything in 02 §1–2. `npx prisma validate`, then `db push` per 02 §9. | Tables exist, user count unchanged |
| 0.9 | `GET /app-config`; `martGate`; `requireProfile`; `requireRules`; empty `martRouter` mounted at `/mart`. | Non-beta phone gets 404 on `/mart/me`; beta phone gets 200 |
| 0.10 | Mobile shared components: `MartEmptyState`, `MartToast` (minimal), `RatingBadge`, `ReviewsModal` (shell), `MartPhotoViewer`, `MartListingCard`, status tag components, bottom sheet helper. Theme token mapping per 04 §0.1b. | Storybook-less: a hidden dev screen renders each in light + dark |
| 0.11 | Navigation: add `mart` tab to `TAB_SCREENS`/`BottomTabBar` (hidden when `martEnabled` is false), extend the `Screen` union in `App.tsx` and keep a `screenStack: { screen, params }[]` with `push(screen, params)` and `pop()` (Android back = pop; `backMap` is only the fallback when the stack is empty; pickers return values through a callback in `params`). Add the `GET /app-config` fetch on launch and after login (failure = Mart disabled). Extend notification tap routing (`App.tsx` ~725–751) to read `threadId`, `listingId`, `tab` and branch to `martThread/martListing/martWanted/martReviews/martMyAds/martNotifications`. | Tap on a fake `mart_*` notification opens the right placeholder; unknown target still falls back safely |
| 0.12 | `POST /uploads/photo` accepts `folder=mart` (whitelist), key prefix `mart-photos/`, separate rate scope. | Upload goes to the right prefix; other folder values are rejected |
| 0.14 | **Native modules check:** confirm `expo-image-picker` (camera + multi-select) and `expo-image-manipulator` (resize) are in the installed v1.0.3 binary. If not, bump `appVersion` and ship a new EAS build before Milestone 1 (OTA cannot add native modules; `runtimeVersion = appVersion`). | Photo pick + resize works on a device |
| 0.13 | Account deletion: extend `scripts/deleteAccount.ts` (02 §10) and add `DELETE /auth/account` + the in-app screen (typed confirm). Can slip to Milestone 3, but must be done before public launch. | Test account deleted, Mart rows gone, reports kept |

---

## Milestone 1 — Core loop (beta on Vikum's phones)

| # | Step | Backend | Mobile | Done when |
|---|---|---|---|---|
| 1.1 | Mart profile | `GET/PATCH /mart/me`, `POST /mart/rules/accept` | Name+district sheet, rules screen, pickers 21.1–21.3 | Sheet and rules flow works; PATCH validates |
| 1.2 | Post ad | `POST /mart/listings` (selling), validation 02 §4.1 | Posting screen (04 §2), one-by-one photo upload with retry, client resize 1280px q0.7 | Post a real ad with 3 photos; failing a photo keeps the form |
| 1.3 | Feed + filters | `GET /mart/listings`, `/count`, search history upsert | Mart Home grid (04 §1), Filters (04 §4), search | Category/vehicle/price/district/condition/sort all change results; "Show N results" matches |
| 1.4 | Detail + similar | `GET /mart/listings/:id`, `/similar`, `/more-from-seller` | Detail (04 §3), photo viewer, share (plain text + store link) | Detail loads for owner and visitor; (set a sold ad through SQL to check the 7-day hiding) |
| 1.5 | Edit, status, delete | `PATCH`, `DELETE`, `/status` | Edit via the posting screen, My Ads menus | Reserve/Available/Delete work; (set a sold ad through SQL to check it cannot be edited) |
| 1.6 | My Ads + My Mart | `GET /mart/my-ads` | 04 §7, §8 | Tabs and counts correct |
| 1.7 | Favorites | `/mart/favorites` (3 routes) | Heart on cards/detail, Favorites list (04 §10) | Sold/removed show grayed with label |
| 1.8 | Chat | `/mart/threads` (all), messages, read, unread-count, snapshots | Inbox (04 §5), Thread (04 §6), "Message Seller" with prefilled text, unread dot | Two phones chat; unread dot correct; one-sided delete; closed-ad banner |
| 1.9 | Push for messages (also add the three Mart push toggles in notification settings) | `mart_message` notification + push (02 §7.1, one row per thread) | Tap opens thread | Push received; second message updates the same row |

**Milestone 1 check (all must pass):** full buy-side and sell-side flow between two beta phones; app restart keeps state; a non-beta phone sees no Mart; existing garage/vehicle features still work (smoke test: login, add vehicle, booking); dark mode looks right on every M1 screen; Android build via EAS or OTA to `preview` branch.

---

## Milestone 2 — Wanted, deals, ratings, shops

| # | Step | Backend | Mobile | Done when |
|---|---|---|---|---|
| 2.1 | Wanted ads | `type=wanted` create/feed, `matchesYou`, detail variants | Selling\|Wanted switch on Home, posting variant, Wanted feed (04 §12), detail (04 §19) | Post a request; it appears in the Wanted feed; Matches-you chip right |
| 2.2 | Offers | `POST .../offer`, `GET .../offers` | Offer sheet (04 §14.1), offers list (04 §14.2) | One offer per seller; second returns existing thread |
| 2.3 | Wanted alerts | 02 §7.3 background job + `MartWantedAlert` | Notification tap opens request | Seller with a past matching ad gets exactly one alert |
| 2.4 | Mark sold / fulfilled + confirm | `/mark-sold`, `/buyers`, `/relist`, `/deal/confirm` | Who-bought-it sheet, confirm banner (04 §9) | Full pending → confirmed path; decline shows nothing to seller |
| 2.5 | Ratings | `/rate`, guards 02 §4.6 | Rate modal (04 §9.3), "Rate seller" link | Second rating blocked; rating needs 2 messages |
| 2.6 | Shop profile | `GET/PUT /mart/shop-profile` | 04 §15 with Garage prefill | Garage owner sees prefill; non-shop gets 403 |
| 2.7 | Seller profile + reviews | `GET /mart/sellers/:id`, `/listings`, `/reviews` | 04 §16, §17 (Shop A / Casual B layouts) | Rating avg matches DB; garage service rating shown separately |
| 2.8 | Followings | `/mart/follows`, `/follows/feed` | 04 §18, Follow button | Follow/unfollow; feed shows followed sellers' ads |
| 2.9 | Notification center | `/mart/notifications` (4 routes), all types in 02 §7.1 | 04 §13, bell dot on Mart Home | Each type opens the right screen |

**Milestone 2 check:** run the full wanted → offer → chat → fulfilled → confirm → rate story and the full selling → sold → confirm → rate story with two phones; seller tag flips to Shop after 5 ads in 90 days (test by changing a threshold locally); no phone number appears in any response (grep responses for digits matching test phones).

---

## Milestone 3 — Safety and launch readiness

| # | Step | Backend | Mobile | Done when |
|---|---|---|---|---|
| 3.1 | Report | `POST /mart/reports`, admin push, `GET /admin/reports`, `.../reviewed` | Report sheet (04 §20.1) from detail, chat, profile | Duplicate within 24h ignored; admin phone gets push |
| 3.2 | Block | `/mart/blocks` endpoints (the `blockedSet` helper already exists from Step 0.6 and is already called everywhere) | Block sheet (04 §20.2), Blocked list | Blocked user disappears both ways; chats return on unblock |
| 3.3 | Rules re-ask test | `requireRules` is already applied in 1.2, 1.8, 2.2 | Gate flow (04 §22) | Bump `MART_RULES_VERSION`: the next post/message/offer re-asks |
| 3.4 | Account deletion + backups | Step 0.2, 0.13 finished | Delete account screen | Done checks of 0.2 and 0.13 |
| 3.5 | Customer Service row | — | Row hidden while `MART_SUPPORT_WHATSAPP` empty | Hidden now; shows when set |
| 3.6 | Admin remove (approved) | `POST /admin/mart/listings/:id/remove` | — | Removed ad disappears from feed |
| 3.7 | si/ta strings + category/district labels | — | i18n keys for all Mart text; English fallback | Language switch works with no missing-key text |
| 3.8 | Hardening | Add indexes noticed slow; review rate limits | Error/empty/offline states (04 §22) | Walk every screen with network off |

**Public launch checklist:** Milestone 1–3 checks green; `MART_BETA_PHONES` emptied; app version bumped (`versionCode` +1, new runtimeVersion if native code changed — Mart adds no native modules, so OTA is enough unless the photo picker needs a new one); Play Console status confirmed by Vikum; daily backup running; rules text reviewed by Vikum; Customer Service number added if available.

---

## Phase 2 (do not build now)
Saved filters + alerts, For You/Watchlist (uses `MartSearchHistory` + registered vehicles), Wanted specialty picker, admin web portal, deep links (needs a domain), moderation tools, API versioning + `minVersion` enforcement, staging environment.

## Known risks (watch these)
1. **Single environment.** Any bad `db push` hits production. Backup first, additive only.
2. **Render free sleeps** (cold start ~30s): the first Mart call after idle is slow; show skeletons, never time out under 30s.
3. **Neon free** has a 7-day backup window only: the daily dump job matters.
4. **No API versioning:** old app versions must keep working. Never rename or remove a field the shipped app (v1.0.3) reads.
5. **No staging:** test on the beta phones with real production data behind the gate.
6. **Image storage cost:** R2 is cheap but orphan uploads accumulate; fine for Phase 1.
7. **N+1 queries:** ratings, tags, favorites, matches must be batched per page (03 §0 and 02 §6).
