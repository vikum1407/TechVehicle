# Vocksy Mart — Decisions Made

Log of choices made during the build that weren't spelled out in the handoff package, or that were confirmed with Vikum along the way. Newest first.

---

## 2026-10-17 — Milestone 3 Step 3.7: si/ta strings + category/district labels (complete)

Converted every Mart screen (28 files) and all 10 shared Mart components from hardcoded English JSX text to the `mart.*` i18n namespace in `en.ts`/`si.ts`/`ta.ts`. `en.ts` is authoritative (every key); `si.ts`'s own type (`Record<TranslationKey, string>`, not `Partial`) means it must have every key too, so it's fully complete; `ta.ts` stays `Partial` per the existing app-wide convention, but every new Mart key got a real Tamil translation anyway rather than leaving gaps — this step doesn't add to the pre-existing Tamil gap elsewhere in the app ([[tamil_translation_gap]]), only closes it for Mart's own ~250 new keys.

**Infrastructure built along the way, not called out in the spec:**
- `localizedLabel(language, item)` in `martHelpers.ts` — the single place that now decides which of `.en`/`.si`/`.ta` to show for a district or top-level category, replacing ~15 separate `.en`-only reads across screens. Category **sub-types** (e.g. "Pistons and rings") stay English-only by design — `02-data-model.md` §8.3's own shape has no si/ta field there, only on the 12 top-level categories.
- `formatBudget()`/`memberSinceLabel()` in `martHelpers.ts` changed signature to take `t` as their first argument, matching `timeAgo()`'s existing pattern — required updating every call site (7 files) in the same pass to keep the build green.
- `MART_RULES` (`mobile/src/constants/martRules.ts`) restructured to carry en/si/ta per rule, with a new `getLocalizedMartRules(language)` helper — this was the one piece of content that had never been touched at all before this step (the handoff package itself flagged it "English only for now — si/ta come in Step 3.7"). Same first-draft, Vikum-should-review status as the English wording always had (rule 7's "not responsible for disputes" line especially) — not a meaning change, so `MART_RULES_VERSION` was NOT bumped. Backend's own copy of `MART_RULES` stays English-only (comment updated to say why) since nothing ever actually serves that content to a client — only `MART_RULES_VERSION` on the backend is real.

**Real dead code found and removed along the way** (not the point of this step, just encountered while reading through every screen): `MartHomeScreen`'s, `DetailScreen`'s, and `SellerProfileScreen`'s own unused `comingSoon()`/`defaultT()` stubs — leftover from steps before the real screens they stubbed existed. Also found and fixed the same `onChangeText={t => ...}` local-variable-shadows-the-translation-`t` bug in `OfferSheet`, `PostAdScreen`, `ShopProfileScreen`, `MartEditProfileScreen`, `NameDistrictSheet`, `MartReportSheet`, `RateSellerModal`, `FiltersScreen`, `VehiclePickerScreen` — all renamed to `v`.

**Scope note:** this is UI text only. No backend changes, no schema changes, no new endpoints — purely additive to `en.ts`/`si.ts`/`ta.ts` plus the `mart.*`-prefixed replacements in the screen files themselves.

---

## 2026-10-17 — Photo upload still broken on the dev phone after a restart; deferred, not fixed

Investigated a repeat of "add a photo, it never shows" on `PostAdScreen` (Selling and Wanted both). `adb logcat` showed zero JS console output at all during the attempt — our own `addAssets()` code never ran — but real native `OutOfMemoryError`s from Glide (`Failed to allocate a 51MB allocation with ... 37MB until OOM`) inside the **system Photo Picker's own thumbnail grid** (confirmed via `adb shell dumpsys meminfo`: Vocksy ~295MB, Google Play Services ~135MB, plus Gmail/Drive/Docs/Search/Photos/keyboard all resident at once). Also reconfirmed the Oct 16 `legacy: true` fix no longer reliably prevents the GMS `PhotoPickerActivity` (the modern unified picker) from launching on this device/OS state — the flag doesn't force the old picker the way it did when first added.

Asked Vikum to restart the phone and close other apps before retrying, on the theory this was transient memory pressure. **Retried after a full restart — same symptom.** Given that, this isn't simply "too many background apps right now" — it's either a lower memory ceiling than expected on this device even at rest, or the system Photo Picker module itself has a problem on this specific device/OS build that a restart doesn't clear. **Deferred at Vikum's call** ("it's ok... shall we move next") rather than investigated further this session.

Kept the one real, independent bug found along the way: `addAssets()`'s `ImageManipulator.manipulateAsync()` call had no error handling at all — any failure there (whatever the cause) left that photo tile permanently stuck invisible (`localUri` never left `''`) with zero visible error, instead of showing the existing retry-on-error UI the tile already supports. Added a `try/catch` so a failure now surfaces a real error + retry, regardless of root cause. Removed the temporary `[PostAdDiag]` console logging used to diagnose this, now that the native-level cause (not a JS-reachable one) is understood.

**Not yet investigated, worth trying next time this comes up:** whether the same failure reproduces on a different device (Motorola or Samsung J4, per [[test_devices]]) — if it's J5-specific, that's stronger evidence of a hardware/OS ceiling rather than something fixable from the app side at all.

---

## 2026-10-17 — Milestone 3 Step 3.4: Account deletion + backups

**Backend.** Extracted the deletion logic out of `scripts/deleteAccount.ts` into a shared `utils/accountDeletion.ts` (`deleteUserAccount(prisma, phone)`), so the CLI script and the new `DELETE /auth/account` route (authMiddleware + a tight rate limit: 3/hour, since it's irreversible) both call the same code rather than duplicating it. Implements 02-data-model.md §10 exactly: deletes `MartFavorite`/`MartFollow`/`MartBlock`/`MartSearchHistory`/`MartShopProfile`/`MartWantedAlert`/`MartSellerRating` by phone, `MartThread` where the phone is `otherPhone` (cascades `MartMessage`), then all `MartListing` owned by the phone (cascades favorites/threads/messages/ratings tied to those ads) — then the existing non-Mart deletion (vehicles/garage/notifications/user), unchanged. `MartReport` rows are deliberately kept per spec (investigation trail). Added best-effort R2 photo cleanup (a `DeleteObjectCommand` loop, same client pattern as `routes/uploads.ts`'s `makeR2Client()`, duplicated rather than imported since uploads.ts doesn't export it) — scoped only to the deleted ads' `photoUrls` and the shop logo, per spec; deliberately does NOT touch `User.profilePhotoUrl`, since that field predates Mart and is shared with the non-Mart app's own Profile screen.

**Mobile.** Replaced My Mart's "Edit" destination (previously the name-and-district-only `NameDistrictSheet`) with a new full `MartEditProfileScreen` (name, district, profile photo — self-loads via `GET /mart/me`, same load/error/retry shape as other Mart screens). Only reachable by non-shop users though (Edit branches `me.tag==='shop' ? ShopProfileScreen : MartEditProfileScreen`, unchanged) — so **"Delete my account" was placed as its own row in My Mart's own ABOUT group instead of nested inside MartEditProfileScreen**, specifically so it's reachable by BOTH shop and casual sellers; a row inside the Edit screen would have been invisible to every Shop-tagged user. New `DeleteAccountSheet` (bottom sheet: warning bullets of what's removed, a text field requiring the literal text `DELETE`, a red "Delete my account" button) calls `DELETE /auth/account` then the same `onAccountDeleted` → `App.tsx`'s existing `handleLogout`, reusing its local-session wipe rather than writing a second one.

**Not independently tested on-device yet.** Backend type-checks clean (`tsc --noEmit`, same 7-line pre-existing baseline, zero new errors) and was reviewed line-by-line against 02§10, but **the destructive deletion logic itself was deliberately never run against this machine's local `backend/.env`** — that file's `DATABASE_URL`/R2 values are the ones the top-level CLAUDE.md's "every Codespace session" setup describes (i.e. they may be production's, not the separate Mart-dev project's), and Step 0.9's own incident already established the standing rule "never run the full server locally against production for a one-off test again." A local run of `npm run dev` or a local test script here risks hitting production directly, which is categorically unacceptable for an irreversible delete — unlike earlier steps' "verified against production" cases, which were all either read-only or clearly-reversible additive writes. Safe verification path: push to `feature/mart`, let Render redeploy the separate `techvehicle-backend-mart-dev` service (which has its own, actually-separate env vars set in its own dashboard), and test end-to-end on-device with a **throwaway** Mart-dev test account — never a real one, since this cannot be undone.

---

## 2026-10-16 — Milestone 3 Step 3.3: Rules re-ask test (verification only, no feature built)

`requireRules` already compared `user.martRulesVersion !== MART_RULES_VERSION` (not just presence of acceptance) since it was first built across Steps 1.2/1.8/2.2 — this step's own "done when" is purely proving that mechanism actually re-prompts, not building anything new. Temporarily bumped `MART_RULES_VERSION` 1→2 in both the backend (`data/martRules.ts`) and mobile (`constants/martRules.ts`, the documented "duplicate, keep in sync" copy — both must move together since the mobile accept call sends its own local constant's value, not a value read from the backend). Confirmed on-device with an account that had already accepted v1: posting/messaging/offering correctly re-triggered the gate, re-accepting worked, and the original action completed normally afterward. Reverted back to version 1 immediately after confirming — the rules text itself isn't actually changing, this was only testing the version-comparison mechanism.

---

## 2026-10-16 — real gap: no feedback re-blocking someone already blocked

Vikum found that tapping "Block user" again on an already-blocked profile did nothing visible — `POST /mart/blocks` is an upsert, so it silently succeeded again with no indication anything changed. Seller Profile is the one place a blocked person's profile stays reachable at all (deliberately, per Step 2.7's `iBlockedThem` design, specifically so there's a way back to unblock someone) — so rather than just adding an "already blocked" message, the "..." menu now reflects the real state: it offers **"Unblock user"** instead of "Block user" once `iBlockedThem` is true, calling the existing unblock endpoint directly (no sheet — the consequences sheet is specifically about the decision to block, not relevant to undoing it). Detail and Chat thread don't need the same fix: once you've blocked someone, their listings 404 for you (symmetric `blockedSet` filtering) and chat threads vanish from both inboxes, so neither screen stays reachable for an already-blocked person the way the profile does.

---

## 2026-10-16 — Milestone 3 Step 3.2: Block

- **The enforcement side was already fully built back in Step 0.6** — `blockedSet()` has been called from every feed/thread/profile/message-send query since day one (per its own original comment, and confirmed by grep: already used in 5+ places in `threads.ts` alone, including the exact `POST /:threadId/messages` 403 the spec describes). This step only adds the WRITE side: nothing ever populated `MartBlock` until now, so none of that existing enforcement had anything to act on. `follows` already rejected a blocked pair too (`POST /mart/follows`, Step 2.7), confirming this was genuinely designed and built ahead of time throughout, not a gap.
- **`POST/DELETE/GET /mart/blocks` added to the same `safety.ts`** as Report (no new file) — mirrors `POST /mart/follows`'s own lighter gate (no `requireProfile`/`requireRules`), and reuses `FOLLOW_BLOCK` from `MART_RATE_LIMITS` (already named for both together since Step 0.6/0.7).
- **`GET /mart/blocks` has no cursor/pagination**, matching the spec's own response shape (`{ items: [...] }`, no `nextCursor`) — a blocked list is expected to stay short in practice.
- **Detail's "..." menu doesn't exist as a combined menu** (Share/Favorite/Report are each their own direct header icon, an established pattern on this screen predating this step) — rather than restructure the just-shipped, just-tested Report icon into a combined overflow menu, Block was added as a 4th standalone icon (`person-remove-outline`) next to it, lower risk, same interaction pattern already on the screen.
- **`MartBlockSheet`'s `sellerSubtitle` is caller-formatted, not computed inside the sheet** — each of the three callers (Seller Profile, Detail, Chat thread) has seller context in a different shape (full `Seller` object vs. just `{id,name,photoUrl,tag}` from a thread's `other`), so the sheet takes one pre-formatted optional string instead of assuming a specific data shape.
- **After blocking from Chat thread, the screen navigates back** (`onBack()`) rather than trying to reload the now-blocked thread — the blocked pair's thread becomes invisible to both inboxes per spec, so there's nothing useful left to show there.
- **The "Also block" button on `MartReportSheet`'s success screen is wired for real now** in all three callers (Detail, Seller Profile, Chat thread) — it was built but deliberately left hidden in Step 3.1 since Block didn't exist yet; now it opens the real `MartBlockSheet`.

---

## 2026-10-16 — Report threshold notice (Vikum's request, scoped via explicit questions before building)

After testing Step 3.1, Vikum asked for the reported seller/user to be informed once a target has built up multiple reports, rather than only admins knowing. Scoped with him directly (his answers in parens) before writing code: exactly **3** (not just an example), counted by **distinct reporters** (not raw report rows — one person re-reporting after the 24h dedup window shouldn't alone trigger this), and the notification text is **generic** — no reasons, no reporter count, no names, just a reminder to review the Mart rules, so it can't be used to infer exactly what's being watched or by whom.

- New `notifyTargetIfThreshold()` in `safety.ts`, runs after every new report (any one could be the one that crosses 3). Counts **open** reports only — an admin marking reports reviewed effectively resets the count, since there's no point re-flagging something already looked at.
- **Fires once per target, not on every report past the threshold** — dedup by checking for a prior `mart_report_threshold` notification whose `linkTo` contains this exact `targetId`. No new schema field needed; same string-match-on-`linkTo` approach the existing non-Mart `/notifications/read-booking/:bookingId` route already uses.
- **`linkTo` is deliberately not a real navigable target** (`{ screen: 'martReportThreshold', targetType, targetId }`) — there's nothing useful to deep-link to for a generic "review the rules" notice, and no routing branch matches that screen name, so tapping it just stays on the notification list (same practical effect as `linkTo: null` elsewhere in Mart, but still carries `targetId` for the dedup check above).
- **Not gated by a notification preference** — same "always" reasoning as the existing `mart_report_received` (admin) notification: this is an account-standing notice, not optional social noise.

---

## 2026-10-16 — Milestone 3 Step 3.1: Report (first step of Milestone 3 — Milestone 2 is fully closed out)

- **`ADMIN_PHONES` fails CLOSED, unlike `MART_BETA_PHONES`'s fail-open default.** New `adminGate` middleware (mirrors `martGate`'s shape) treats empty/unset `ADMIN_PHONES` as "nobody is admin" — the opposite default from the beta gate, since this guards genuinely sensitive data (report contents, reporter identities), not just an unshipped feature. 404 (not 403) on rejection, same reasoning as the beta gate: don't reveal the surface exists.
- **New top-level `/admin` mount** (`backend/src/routes/martAdmin.ts`, `app.use('/admin', authMiddleware, adminGate, martAdminRouter)`), separate from `/mart` entirely — `GET /admin/reports`, `POST /admin/reports/:id/reviewed`, `POST /admin/mart/listings/:id/remove`. No mobile admin screen built (not in this step's own Mobile column of the build plan) — these are backend-only for Vikum to use directly for now, per the spec's own "Admin actions on accounts are manual... in Phase 1."
- **`safety.ts` is mounted at `/mart`'s root** (`martRouter.use('/', safetyRoutes)`), not a sub-prefix like every other area router — it's the one file in 03-api.md §0's own file list that owns two independent top-level paths (`/mart/reports` now, `/mart/blocks` once Step 3.2 adds it to the same file).
- **`targetType: 'wanted'` is UI-only**, never sent to the API — `MartReportSheet`'s prop accepts it (04-screens.md §20.1's own component signature lists it) purely to pick the right sheet title ("Report this request"), but the wire body always sends `'listing'` for both selling and wanted ads, matching 03-api.md's literal 3-value `targetType` union (the data model has no separate "wanted report" concept — both are `MartListing` rows).
- **Chat thread header's single "Report" stub became two real menu items**, "Report User" and "Report Ad" — 04-screens.md §20.1 names the chat header as reporting "the user or the ad" (two targets from one entry point), not a single generic report.
- **The "Also block" button on the success screen is entirely omitted (not shown disabled/stubbed) wherever Block doesn't exist yet** — `MartReportSheet`'s `onBlock` prop is optional and no current caller passes it (Step 3.2 isn't built). Matches the spec's own "Not shown for own content" precedent of the button being conditionally absent, not a dead stub.

---

## 2026-10-16 — Milestone 2 Step 2.9: Notification center

- **New `backend/src/routes/mart/notifications.ts`**, a thin Mart-only view over the existing shared `AppNotification` table (same table every mart_* type across Steps 1.9–2.8 already writes to) — filtered to `type startsWith 'mart_'`, matching 02-data-model.md §7.2 exactly. No new table, no new write path.
- **Row tap reuses `App.tsx`'s own `handleNotificationData`** (the dispatcher built for real push-notification taps) instead of writing a third copy of the linkTo routing chain — that function already takes a flat `{screen, threadId, ...}` object, which is exactly a parsed `linkTo`'s shape. Threaded through as a new `onNavigateNotification` prop on `MartNavigator`.
- **Closed a real pre-existing dead link found while wiring this**: `mart_rating`'s own `linkTo` (`{ screen: 'martReviews' }`, built in Step 2.5) was never routed anywhere, in either `handleNotificationData` or the existing `NotificationsScreen`'s own `onNavigate`. There's no dedicated "my reviews" screen/modal in My Mart, but `SellerProfileScreen` already shows a seller's own reviews correctly when viewing your own id (`isMe: true`) — reused that (fetches the viewer's own Mart `User.id` via `GET /mart/me` on demand, then opens their own Seller Profile) rather than building new UI just for this one link.
- **Excluded `mart_*` types from the existing (non-Mart) `/notifications` routes** (`GET /`, `/unread-count`, `POST /read-all`) — this was explicitly flagged, not fixed, back in Step 1.9's own decision log ("naturally self-limiting for now... until Mart's own separate notification center ships at Milestone 2 Step 2.9"). Without this, a Mart row would show up — and could be bulk-marked-read, or counted toward the bell dot — in both notification centers at once. `POST /read-booking/:bookingId` already filtered `type: 'message'` specifically (the non-Mart message type), so Mart's own `mart_message` rows never matched it anyway — left untouched.
- **Bell icon was already present in `MartHomeScreen`'s header** (built ahead of time in Step 1.3 as an intentional no-op stub, per its own code comment) — just wired to the real screen and a real unread-count badge, same pattern as the existing Messages icon right next to it.

---

## 2026-10-16 — real bug: Seller Profile's ad grid cards weren't equal width

Vikum spotted the two cards in a row of the Seller Profile's Ads tab (Shop layout) rendering at visibly different sizes, and correctly guessed it tracked the photo. Root cause: `renderAdCard()`'s wrapping `<View>` had no size hint at all for the 2-column grid case (only the Casual layout's fixed-width horizontal strip passed an explicit `width`) — `MartListingCard`'s own root is `flex: 1`, which only distributes evenly when its direct parent already has a determinate width to flex against. Mart Home's own grid never wraps `MartListingCard` in an extra View at all (renders it directly as the row child), so this never came up there. Fixed by giving the wrapper `flex: 1` whenever no fixed `width` is passed.

---

## 2026-10-16 — "DECLINED" fix retested, still showed "FULFILLED" for the requester

Same directional bug class hit twice already today, a third time: the chat thread's pinned header used `deal.iAmPartner` to decide whether to show "NEED TO CONFIRM"/"DECLINED", but `iAmPartner` is only true for whoever `dealPartnerPhone` equals — the chosen seller, never the requester (the Wanted ad's owner). The requester viewing their own deal thread is `isListingOwner`, not `iAmPartner`, so the condition never matched for them and it fell through to the plain "FULFILLED" label. Fixed by exposing the already-computed `isDealThread` (`dealPartnerPhone === me || dealPartnerPhone === thread.otherPhone` — already used earlier the same day for the deal-thread-stays-sendable logic) on the `deal` object instead, which is correct from either side.

---

## 2026-10-16 — two more real bugs found testing the decline notification fix

1. **Detail's own owner bottom bar never checked listing status at all.** It always showed Edit + Mark Sold/Fulfilled to the owner, even on an already-closed (sold/fulfilled, including declined) ad — only `MyAdsScreen`'s own Sold/Fulfilled tab had status-aware buttons; `DetailScreen`'s bottom bar had no equivalent check and had been like this since Mark Sold first shipped (Step 2.4). Fixed: when `detail.isOwner` and `status` is sold/fulfilled, shows Relist + Delete instead.
2. **The "Need to confirm" fix only covered the pending case, not declined.** `status` stays sold/fulfilled permanently after a decline (until Relist) — the chat thread's pinned header and the inbox list both kept saying "Sold"/"Fulfilled" right next to (or right after a push for) "Seller said they didn't sell this," the exact same contradiction the first fix was meant to close, just for the other terminal state. Both now show "Declined" for the specific deal thread when `dealState === 'declined'`. The inbox's backend field was generalized from a single `dealPending` boolean to `dealStatus: 'pending' | 'declined' | null`, since it was clearly going to need a third value next.

---

## 2026-10-16 — real gap found via a discussion question: no way to relist a Wanted ad at all

Vikum asked how to relist a Wanted ad that got declined. Checked: there was no way — `MyAdsScreen` (where Relist lives) was hardcoded `type: 'selling'` since Step 2.1, and `DetailScreen` has no Relist button of its own. The backend's `POST /:listingId/relist` already fully supports Wanted (resets `status` to `'open'`, same as selling does to `'available'`) — nothing backend needed changing, only that no mobile screen ever called it for that type.

**Fixed by extending `MyAdsScreen` to support both types** (Vikum's choice over the smaller "just add Relist to Detail" option, since this also gives Wanted ads visibility they never had at all): a Selling|Wanted segmented switch reusing Mart Home's own styling, Wanted gets its own two tabs (Open/Fulfilled, mirroring Selling's three), a "Mark Fulfilled" action on the Open tab (same `WhoBoughtItSheet`, `type="wanted"`), and Relist/Delete on the Fulfilled tab. Card display branches on type (budget range vs price, replies count vs saved/chats count, "Fulfilled" vs "Sold" wording). `onOpenPostAd`/`onOpenEdit` already supported a type param elsewhere in the stack — just needed forwarding through from My Ads, which never passed one.

---

## 2026-10-16 — real gap found via a discussion question: "Not me" told the seller nothing

Vikum asked what happens today when the other side taps "Not me" on the confirm banner. Checked the code: `dealState` becomes `'declined'`, but the listing's `status` never reverts (stays permanently sold/fulfilled), no system message was added to the chat, and no notification was sent to the seller at all — the confirm/decline endpoint only ever notified on the `confirm: true` branch. The seller had no way to find out a deal fell through short of noticing the confirm banner had quietly vanished from that one thread. The only recovery path, Relist, already existed and still works the same (resets `dealPartnerPhone`/`dealState`/`status` and bumps the ad back to the feed) — this was purely a missing-notification gap, not a missing-recovery one.

**Fixed**, mirroring the existing confirm-path pattern exactly (same `mart_message` pref gate, same `linkTo` shape — My Ads' Sold tab for selling so the seller can Relist from there, back to the thread for wanted): a chat system message ("Buyer said they didn't buy this" / "Seller said they didn't sell this") plus a real notification (new type `mart_sale_declined`) to the seller.

---

## 2026-10-16 — two UX fixes, discussed before building per Vikum's request

1. **"SOLD" shown next to a still-pending confirm action read as contradictory.** The listing's `status` flips to sold/fulfilled the instant the seller marks it, but `dealState` stays `'pending'` separately until the other side actually confirms (and can decline). Both the chat thread's pinned header and the Messages inbox list showed a flat "Sold" the whole time, including right next to (or right after getting a push for) a pending "Confirm sale" action. Fixed in both places: shows "Need to confirm"/"NEED TO CONFIRM" while `dealState === 'pending'` for the specific deal thread (`dealPartnerPhone === otherPhone`, i.e. `iAmPartner`), switching to "Sold"/"Fulfilled" once actually confirmed. Every other (non-winning) thread on the same ad still just says "Sold" — nothing to confirm there. The inbox list needed a new `dealPending` field added to `GET /mart/threads`'s response (computed the same way), since it didn't carry deal state at all before.
2. **No quick way back to Mart Home from deep inside Mart.** Re-tapping the "Mart" bottom-tab icon while already inside Mart now resets its internal navigation stack back to Home — same pattern most tab apps use (e.g. Instagram: tapping your current tab again returns to its root). Implemented with the same "signal prop" pattern `MartNavigator` already uses for notification deep-links (`focusListingId` etc.) — App.tsx increments a counter on a Mart-tab re-tap, `MartNavigator` resets its stack when that counter changes.

---

## 2026-10-16 — real bug: photo picker broken on-device, "Uri lacks 'file' scheme"

Vikum reported Post Ad's photo picker opening fine, letting him select a photo, then showing nothing — no thumbnail, no spinner, no error. Diagnostic logging (temporary, added then removed) showed the native call itself rejecting: `java.lang.IllegalArgumentException: Uri lacks 'file' scheme: content://media/external/file/48293`. A device reboot didn't fix it, and the identical bug reproduced in the Offer sheet's photo picker too — both use byte-identical `ImagePicker.launchImageLibraryAsync()` calls that had worked fine on this same device (Samsung J5) just days earlier.

**Root cause: a device/OS-level regression, not an app bug.** `expo-image-picker`'s default (non-`legacy`) Android code path relies on handing off to the system's Photo Picker component and resolving its result to a `file://` URI; something about that resolution broke on this device between sessions — most likely a background Google Play system update to the Photo Picker module itself, since nothing in the app's own code or package versions changed (`npx expo install --check` confirmed everything still matches the installed SDK).

**Fix:** `expo-image-picker` ships exactly this escape hatch — `legacy: true` (Android-only, default `false`), which forces the older, more broadly-compatible picker intent instead. Applied to all three Mart photo pickers (`PostAdScreen.tsx`, `OfferSheet.tsx`, `ShopProfileScreen.tsx`). Confirmed fixed on-device.

**Flagged to Vikum, not yet acted on:** this exact same `launchImageLibraryAsync()` pattern (no `legacy` option) also exists in 5 **existing, shipped production screens** — `AddServiceRecordScreen.tsx`, `AddVehicleScreen.tsx`, `GarageScreen.tsx`, `ProfileScreen.tsx`, `VehicleDashboardScreen.tsx` — none touched here, since those are live production code outside this Mart-dev branch's normal scope and changing them needs his explicit decision, not an assumption. If this is a real OS-level regression (not something unique to this one device), it is very likely breaking photo uploads for real production users on similarly-updated devices right now.

---

## 2026-10-15 — Follow feature extended: new-follower notification, new-ad notification, Followers dashboard (Vikum's explicit request, discussed before building)

None of this was in the original handoff spec at all — Vikum asked directly "are we notifying the seller someone followed them?" and "is there a dashboard showing followers?" after testing Step 2.8, found both were genuinely missing (not deferred, just never speced), and asked for all three to be built. Scoped with him via explicit questions before writing code, per his "discuss first" request:

1. **New-follower notification**: in-app + push, same treatment as every other Mart notification type. `POST /mart/follows` only fires it on a genuinely NEW follow (checked via an `existing` lookup before the upsert) — an idempotent repeat follow never re-notifies. New type `mart_new_follower`, `linkTo: { screen: 'martSellerProfile', sellerId }` (the follower's own profile, so the seller can see who just followed them).
2. **New-ad-from-followed-seller notification**: push + in-app, one per new ad per follower, fired fire-and-forget right after `POST /mart/listings` creates a **selling** ad only ("list down the product" — Wanted requests don't apply; also never fires on relist/edit, only a genuinely new post, same scope rule as `runWantedMatchAlerts`). **Deliberately uncapped** — notifies every follower, unlike the Wanted match alert's ranked top-20 — because following is an explicit opt-in relationship the follower chose, not a guessed-relevance match, so there's no "spam" concern in the same sense. New type `mart_new_ad`. Its `linkTo: { screen: 'martNewAd', listingId }` is routed identically to the existing `martWanted` case in both App.tsx notification-tap handlers (both just mean "open this listing's Detail") — reused rather than duplicated, with a comment explaining why a differently-named type shares the same routing branch.
3. **Followers dashboard**: a `followers` count added to `GET /mart/me`'s `counts` (mirroring the existing `followings` count), a new `GET /mart/follows/followers` endpoint (same shape/pagination/enrichment as `GET /mart/follows`, just reversed — refactored the shared enrichment logic into `buildFollowRows()` so neither endpoint duplicates the other), and a new `FollowersScreen` (read-only mirror of `FollowingsScreen`'s row layout — no unfollow button, since that relationship isn't the seller's to control from this side). New "Followers" row added to My Mart, alongside the existing "Followings" row.
4. **New shared preference key `mart_follow`** (NOT split into separate "new follower" vs "new ad" toggles) covers both notification types together — added to `NOTIFICATION_PREF_DEFAULTS` (default `true`, per the project's "add new keys only, never rename/remove" rule) and a new row in the existing, already-i18n'd `NotificationPrefsScreen` (same exception as Step 1.9's `mart_message`/`mart_wanted`/`mart_rating`: this is a shared, already-translated screen, so it got real en+si copy immediately rather than following Mart's own "plain English until 3.7" rule). si.ts translation is a first-pass, not native-speaker-checked, same caveat as every other si/ta Mart string so far.

---

## 2026-10-15 — Milestone 2 Step 2.8: Followings

- **`GET /mart/follows/feed` skipped**, per 03-api.md §7's own explicit line: "No screen uses it at launch... implement it last or skip." No screen in this build needs it, so it's left out rather than built unused.
- **The response adds a `townAddress` field beyond the documented minimal shape** (`{ seller, activeAdsCount, newestAdAt }`), since 04-screens.md §18 point 3 explicitly requires it for a Shop's area line ("For Shops use `MartShopProfile` town; else district") and the data was already one query away (`MartShopProfile.findMany` alongside the existing `getShopProfiles()` helper, which only returns name/logoUrl).
- **`FollowingsScreen` is NOT added to `MartNavigator`'s `FULL_SCREEN` list** (tab bar stays visible), matching `FavoritesScreen`'s own precedent — both are simple back-header list screens reached from My Mart, explicitly named together in 04-screens.md §0.2's "tab bar visible on" list, unlike `shopProfile`/`sellerProfile` (treated as full-screen detail flows in earlier steps).
- **Unfollow is optimistic with a 4s Undo toast** (`MartToast`, built empty in Step 0.10 specifically for this screen — first real use here): the row fades out and the DELETE fires immediately on tap, matching the spec's "Tap = unfollow immediately" wording. A failed DELETE silently stays removed from this list view only (same fallback `FavoritesScreen`'s own remove-favorite already uses) — the follow still exists server-side and reappears next time the screen loads fresh.
- **"Blocking a user removes the follow both ways" (04-screens.md §18) was not implemented** — `MartBlock` has no UI yet (Milestone 3), so there's nothing to wire this into. Noted for whoever builds Block later.

---

## 2026-10-15 — two real bugs found testing Step 2.7, both fixed

- **Seller Profile's "..." menu could get stuck open and unclosable.** Block user/Report user each called a second `Alert.alert(...)` from inside the first action-sheet Alert's own `onPress` — a known RN/Android issue where the first dialog's dismiss animation collides with the second one's show call. Fixed by deferring the second call with `setTimeout(..., 400)`, a standard workaround for this exact case.
- **Casual layout's Follow button rendered as a tiny pill**, not a real-looking button. Root cause: `casualHeader`'s `alignItems: 'center'` shrinks children to their content size, unlike the Shop header card (plain column, default `alignItems: 'stretch'`) where the same button naturally fills the width. Added a `compact` variant (`followBtnCompact`: fixed horizontal padding, centered) used only for the Casual layout.

---

## 2026-10-15 — Milestone 2 Step 2.7: Seller public profile + reviews

- **Follow/unfollow (`POST`/`DELETE /mart/follows`) built now, not deferred to Step 2.8**, even though 05-build-plan.md's own table splits Followings into its own later step. The Follow button is a core, highly-visible part of Section 16's own screen — shipping it as a dead stub would leave this step genuinely incomplete per the project's "each feature 100% complete before the next starts" rule. `GET /mart/follows` (the Followings list screen) and `/follows/feed` are still left for Step 2.8 exactly as the build plan scopes them — those need their own screen, this doesn't.
- **New `backend/src/routes/mart/social.ts`**, matching 03-api.md §0's own planned file list (it names `social.ts` as a separate area router from `sellers.ts`), mounted at `/mart/follows`.
- **"Blocked-me" vs "I blocked them" are handled asymmetrically**, per the spec's own text: the seller having blocked the viewer 404s the whole profile (can't be found at all); the viewer having blocked the seller still returns the full profile with `iBlockedThem: true` so they can see who they blocked. `MartBlock` is empty until Milestone 3 ships the Block button, so this path is unreachable with real data for now — built correctly ahead of time anyway, same pattern as `blockedSet.ts`'s own original comment.
- **`stats.soldCount` is selling-ads-only**, mirroring `getActiveAdsCounts()`'s own established scope (that function's comment already named Step 2.7's Ads tab as a reason it's selling-only) — a Wanted request's "fulfilled" count isn't a comparable "sold" concept.
- **`kind=service` reviews reuse the existing `GET /garages/:id/ratings` shape exactly** (fixed take-30, no cursor) rather than inventing new pagination for it — the spec says "reuse that logic," and a Casual-tagged seller can never have a Garage (getSellerTags ties 'shop' to having one), so service reviews only ever appear for Shops anyway.
- **Mobile: the Shop layout's "Reviews" tab is hand-rendered inline** (summary + distribution bars + list, matching `ReviewsModal`'s content) rather than reusing `ReviewsModal` itself, since that component is wrapped in its own bottom-sheet shell and section 17 explicitly says the Shop tab shows the same content "inline, no sheet." The **Casual layout's rating badge and "See all" do reuse the real `ReviewsModal`** (built empty in Step 0.10, wired to real data for the first time here) — Casual has no tabs to render reviews inline into.
- **Only two of this screen's own entry points were wired this step**: Ad detail's seller row (`DetailScreen`) and the chat header's name/avatar (`ChatThreadScreen`) — the two explicit "Opened from" cases 04-screens.md §16 names with existing real UI. Section 17's broader "any rating badge opens Reviews" rule (My Mart's own identity row, Offers List, WhoBoughtItSheet, Detail's embedded `RatingBadge`) was **not** wired everywhere it technically applies — each would need its own local reviews-sheet state since there's no shared place to own it yet. Flagged as a reasonable follow-up, not required by this step's own done-check ("Rating avg matches DB; garage service rating shown separately" — both fully testable via the Seller Profile screen itself).
- **The "..." menu only implements Share profile for real** (native `Share`, no backend, same pattern as Detail's existing Share). Block user / Report user are honest "Coming soon" stubs — both are Milestone 3 (`safety.ts` doesn't exist yet), not faked.

---

## 2026-10-15 — real bug: shop logo saved but never shown (screenshots confirmed name was fine)

Vikum tested Step 2.6 end to end (screenshots from a real Wanted ad + chat): the Shop **name** ("Nipun Auto") was already showing correctly everywhere — ad detail seller row, the Wanted ad as seen by another account, and the chat header. Only the **logo photo** was missing; every one of those avatar circles fell back to the initial "N" instead of the uploaded image, even though the logo was correctly saved (visible in Shop details' own edit screen).

Root cause: `DetailScreen.tsx`'s seller row and `ChatThreadScreen.tsx`'s header avatar never had an `Image` branch at all — they always rendered the initial `Text`, because before this step the seller/other-party API responses had no real photo to show. Step 2.6 added `seller.photoUrl` / `other.photoUrl` to those backend responses, but the two screens were never updated to read them. `WhoBoughtItSheet.tsx` had the same gap for its buyer rows (also fixed, for consistency, even though the backend's `/buyers` endpoint already returned `photoUrl`). `MyMartScreen.tsx` (personal photo) and `OffersListScreen.tsx` (offer's own attached photo, not a seller avatar) didn't need this — they already handled their own cases correctly. `MartHomeScreen`'s feed cards and `ChatInboxScreen`'s rows don't show a seller avatar at all by design (04-screens.md §5: inbox rows use the product thumbnail, not the other person's photo), so neither needed a fix.

---

## 2026-10-15 — Milestone 2 Step 2.6: Shop profile

- **`GET/PUT /mart/shop-profile` has no `requireProfile`/`requireRules` gate** — confirmed by checking 03-api.md §0's endpoint-index table, which lists it as auth-only, unlike `POST /mart/listings`'s explicit "rules+profile". A Shop seller setting up their business details isn't itself a Mart "action" the rules are meant to gate.
- **Garage prefill only covers text fields, never the logo.** `Garage` has no single logo field (only a `photos` array with a different purpose), so the Shop's logo always starts empty on first visit even when the rest of the form prefills from an existing Garage — the seller picks their own.
- **Prefill's district is matched by case-insensitive name lookup against `DISTRICTS`**, since `Garage` stores town/village as free text with no district id of its own. No match → `null`, same as leaving it unset; the user just picks it manually in that case.
- **The mobile form always resends the current `logoUrl` on every `PUT`, including when unchanged.** The backend's `PUT` has no "omit to keep existing" logic — any `PUT` without `logoUrl` set wipes a previously-saved logo. Since the mobile form's local state always holds the current logo (loaded or freshly uploaded), this falls out naturally rather than needing special-casing.
- **The info box ("Filled from your Garage…") only shows when the GET returned a `prefill`** (i.e., first visit, no `MartShopProfile` row yet) — once saved, the data lives in `MartShopProfile` and reopening the screen loads `profile`, not `prefill`, so the box doesn't resurface. Matches the spec's "shown only when the data came from a Garage" literally: after the first save, the data on screen came from Mart's own storage, not the Garage.
- **Casual sellers' "how to become a Shop" hint row was added directly to `MyMartScreen`**, not a separate screen, since the spec names it as that screen's own responsibility ("Casual sellers see a hint row in My Mart…"). My Mart's Edit button now branches on `me.tag` — Shop opens the new `ShopProfileScreen`, Casual keeps the existing name/district `NameDistrictSheet` unchanged.

---

## 2026-10-15 — deal thread stays sendable after mark-sold (Vikum's product call)

The spec's own rule ("sending is blocked when the listing is closed") closed every thread on an ad equally once it sold/fulfilled, including the winning buyer/seller's own thread — right when they most need to keep talking (pickup, payment, delivery). Vikum asked for the winning thread specifically to stay open; every other thread on that ad still closes immediately, since there's nothing left to negotiate on an item that's gone to someone else. Fixed in two places that both independently gated on listing status (`threads.ts`'s `GET /:threadId` canSend and `POST /:threadId/messages`), now both also check `dealPartnerPhone === thread.otherPhone` (the winning thread) as an exception.

**Deliberately NOT touched: the existing 7-day inbox-visibility window** (`isThreadListingVisible()` / `CLOSED_VISIBLE_MS`) — this fix is about whether a message CAN be sent, not how long the thread stays easy to find in the inbox list. The deal thread still vanishes from the inbox after 7 days, same as every other closed thread, even though it stays sendable while it's still visible. Flagged to Vikum as a separate decision if he wants the deal thread's inbox visibility extended too — not assumed.

---

## 2026-10-15 — real bug: "Rate seller" shown to the wrong person on Wanted deals

Found testing on a real device: Vikum reported being able to rate the same seller repeatedly, with the modal always "succeeding." Root cause was two bugs stacking:

1. **The rater role was computed wrong for Wanted deals.** 02-data-model.md §3.3's confirmer (`dealPartnerPhone`/`iAmPartner`) is the same person regardless of type, but the *rater* swaps: selling → the buyer (`dealPartnerPhone`); wanted → the requester (`ownerPhone`). Both `threads.ts`'s `GET /:threadId` (the "Rate seller" banner) and `listings.ts`'s `POST /deal/confirm` (the auto-open-on-confirm path) reused `iAmPartner` for both roles — so on a Wanted deal, the *seller* (the confirmer) kept seeing the Rate option instead of the requester who was actually allowed to use it.
2. **`RateSellerModal` only recognized `ALREADY_RATED` as a real rejection** and failed open (closed exactly like success) for anything else — including the backend correctly 404'ing the wrong person every time. No error ever surfaced, so repeated "successful-looking" attempts were really repeated silent 404s, not duplicate ratings. Fixed to treat *any* backend-provided error code as a real rejection to show, keeping the fail-open behavior only for a true connectivity failure (no code at all).

Net effect confirmed safe in hindsight: no duplicate `MartSellerRating` rows were ever actually created (the DB-level unique constraints were never reached, since the pre-check and the role check both rejected first) — this was a wrong-person/UI-masking bug, not a data-integrity one.

---

## 2026-10-15 — proactive first-action gate on Mart Home (Vikum's request)

- **Mart Home now checks the name/district/rules gate once on mount and shows it proactively**, instead of only ever surfacing when an action (Post Ad, Message Seller, an offer) happens to fail. Vikum found this confusing for a brand new account landing on Mart Home with zero indication that any setup was needed. Both steps stay dismissible (`onClose`/`onBack` just close them) — §22's "reading never needs this" still holds, browsing is invited into the setup, never blocked by it.
- **Only wired into Mart Home**, not every other screen reachable before it — Mart Home is the one screen every path into Mart passes through first (the tab itself), so checking there covers the "brand new user" case this was about without adding the same check redundantly everywhere.
- **`OfferSheet` separately got real gate handling in the same session** (not proactive — reactive, same pattern as `ChatThreadScreen`) after Vikum hit the raw "Please accept the Mart rules" backend error text on a first-ever "I have this" tap — it had never had `PROFILE_REQUIRED`/`RULES_REQUIRED` handling at all, unlike `ChatThreadScreen`/`PostAdScreen`. `WhoBoughtItSheet`/`RateSellerModal`/deal-confirm weren't given the same treatment since reaching any of them requires already having passed the gate via an earlier action.

---

## 2026-10-14 — Milestone 2 Step 2.5: Ratings

- **`threadCanRate()` moved to a new shared file, `backend/src/utils/dealRating.ts`**, instead of staying local to `listings.ts` (where Step 2.4 first put it) or being duplicated into `threads.ts`. `threads.ts`'s `GET /:threadId` now needs it too (for the real `canRate`/`dealBanner: 'rate'` this step adds), and `listings.ts` already imports from `threads.ts` — a reverse import would have been circular.
- **`dealBanner: 'rate'` was already a declared type in `threads.ts` since Step 1.8**, just never assigned (`'confirm_sale' | 'rate' | null`, with only `'confirm_sale'` ever set) — confirms the original build anticipated exactly this. Implemented it now rather than inventing a new mechanism: `dealBanner === 'rate'` is what `ChatThreadScreen`'s "Rate seller" link is gated on, replacing the cruder `deal.state === 'confirmed'` check from Step 2.4 (which didn't account for "already rated" or "didn't chat enough").
- **A failed rating submission in `RateSellerModal` closes the modal instead of showing an inline error and letting the user retry.** The deal is already confirmed at this point — the rating is a nice-to-have, not a required step the user is blocked on, so failing open (same as Skip) is friendlier than trapping them on an error for something optional.
- **No new UI needed to actually display a seller's aggregate rating** — `RatingBadge` (Detail's seller row, Offers List, the Seller type's own `rating` field from `getSellerRatings()`) already reads live `MartSellerRating` data since Step 0.6; it's just been showing "No reviews yet" because no real ratings existed until this step. Submitting one lights it up everywhere automatically.

---

## 2026-10-14 — Milestone 2 Step 2.4: Mark Sold/Fulfilled + confirm

- **`mark-sold`'s system message insertion deliberately does not update the thread's `lastMessageAt`/`lastMessagePreview`/`lastMessageSenderPhone`** — the schema comment on `MartMessage.systemCode` says system lines "do NOT change lastMessage* or unread," and every other open thread on the ad already picks up the Sold/Fulfilled banner at read time via the existing `isThreadListingVisible()`/`listingSnapshotStatus()` logic, so no extra write was needed to make that work.
- **One `WhoBoughtItSheet` component for both "Who bought it?" (selling) and "Who gave you the part?" (wanted)**, not two — same sheet, same `POST /mark-sold` route (spec: "Selling and wanted use the same route"), just type-aware copy. Wired into three entry points: Detail's owner bottom bar, My Ads' per-item Mark Sold buttons, and the Offers List's Mark Fulfilled button.
- **`canRate` computed for real** in `GET /buyers` and `POST /deal/confirm` (both explicitly return it per spec) **but left stubbed (`false`) in `GET /:listingId` and `GET /:threadId`**, same as before — those two were already documented as deferred to Step 2.5 since nothing in the UI acts on them yet; the two new endpoints needed the real value now because their own spec explicitly asks for it.
- **"Confirm purchase" doesn't open the Rate modal** (§9.2 says it should) — that's §9.3, Milestone 2 Step 2.5. Confirming now just resolves the deal and the banner disappears (thread reloads, `dealBanner` is no longer `confirm_sale`). Added the spec's own documented fallback instead: a small "Rate seller" link, shown whenever the deal is confirmed and I'm the partner, stubbed "Coming soon" like every other not-yet-built action.
- **Found and fixed a second pre-existing gap in the same family as Step 2.3's**: `martMyAds` notification routing (needed for `mart_sale_confirmed`'s selling-side `linkTo`) didn't exist anywhere — not in `App.tsx`'s real push-tap handler, not in the in-app Notifications screen's `onNavigate`, and `MyAdsScreen` had no way to open on a specific tab at all. Added all three (the tab-focus prop pattern mirrors Step 2.3's `focusListingId`), and gave `MyAdsScreen` an optional `initialTab` prop.

---

## 2026-10-14 — Milestone 2 Step 2.3: Wanted match alerts

- **`runWantedMatchAlerts()` lives in `listings.ts`, not `src/jobs/`**, and isn't registered with `setInterval` like every other job there. Every existing job in `src/jobs/` is schedule-driven (runs hourly/daily against the whole database); this one is event-driven — it runs exactly once, fired directly from the `POST /` handler right after a wanted listing is created, same fire-and-forget pattern as `threads.ts`'s `notifyNewMessage()`. Putting it in `src/jobs/` would have implied a schedule that doesn't apply here.
- **Found and fixed a real pre-existing gap while wiring this step's `martWanted` push routing**: `App.tsx`'s `handleNotificationData()` — the handler for an actual tapped system push notification (cold start or background tap) — never had any Mart routing at all, not even for `martThread` from Step 1.9. Only the in-app Notifications screen's own `onNavigate` prop had it. A real push tap for a Mart message has been silently doing nothing since Step 1.9 shipped. Fixed both `martThread` and the new `martWanted` in the same pass, since they're the same gap.
- **`WANTED_ALERT_LOOKBACK_MONTHS` (12) applied as `months * 30 days`**, not a calendar-month calculation — the spec just says "12 months," and a flat 30-day approximation is simpler and close enough for a lookback window that's just filtering "roughly how recently this seller was active," not something requiring calendar precision.
- **One seller's alert uses their single most-recently-posted matching ad** for ranking (makeNorm/district comparison), not all of their ads — a seller is only ever notified once per request regardless of how many matching ads they have, so only one needs to be picked for the ranking comparison.

---

## 2026-10-13 — Milestone 2 Step 2.2: Offers

- **Offer Sheet's photo upload is its own inline copy of Post Ad's one-by-one-upload-with-retry pattern**, not a shared component — only one other screen needs this exact shape (max 3 photos, all-optional) and extracting a shared component now would mean guessing its API before a second real caller exists, same reasoning already used elsewhere in this build (e.g. Step 1.1's pickers waiting for Step 1.2 before being wired into real navigation).
- **"Mark Fulfilled" is a stub everywhere it appears** (Detail's owner bottom bar, Offers List's header button) — the real "Who gave you the part?" flow is Step 2.4, not built yet. Same honest-placeholder pattern as "Mark Sold" throughout Milestone 1.
- **No special "Offer" indicator in the Chat Inbox list** — an offer thread looks like any other thread there (preview text is "Offer: Rs. X" or "Sent an offer", which already communicates it). The offer card with photos/price only renders inside the thread itself. Spec doesn't ask for an inbox-level distinction.
- **Offers List's seller row uses the same minimal seller shape as everywhere else** (`id`, `name`, `tag`, `rating` — not the full `Seller` type's `photoUrl`/`district`/`verified`), since §14.2's own described layout never shows those fields. No `buildFullSellerObject()` helper built yet; that's Step 2.7 (Seller public profile)'s job once something actually needs the extra fields.
- **`GET /:listingId/offers` 404s for a non-owner** (same NOT_FOUND pattern as PATCH/DELETE elsewhere), rather than a 403 — keeps the response uninformative about whether the listing exists versus just "not yours," consistent with how ownership checks already work on every other listing route.

---

## 2026-10-12 — Milestone 2 Step 2.1: Wanted ads

- **`repliesCount` added to `buildListingCards()` generally, not just `GET /mart/my-ads`.** `03-api.md`'s shared `ListingCard` type comments it as "wanted cards, owner's My Ads only," but `04-screens.md` §12's own Wanted feed card mockup shows "· 3 replies" in every card's meta line, not just the owner's. Went with the screens spec (what's actually testable/visible this step) — one extra `groupBy` query on the page's wanted listing ids, same pattern already used by `my-ads.ts`.
- **Delivery row dropped from the Wanted ad detail's spec card.** §19 literally lists "Delivery (informational)" as one of the spec card rows, but `deliveryAvailable` is always `false`/ignored for wanted ads (`02-data-model.md` §4.1) — showing a delivery row that can never be anything but "not available" seemed like spec copy-paste residue from the Selling detail screen rather than an intentional row, so it's omitted.
- **Wanted detail reuses the same full-width paging photo carousel as Selling**, not a separate 150×130 horizontal strip component as §19 describes. Lower-risk reuse of an already-built, already-tested component; the visual difference is minor since Wanted photos are optional reference photos, not the main selling point of the screen.
- **No "Similar Requests" section on Wanted detail.** §19 doesn't define one (only Selling's §3 has "Similar Parts"), and `MartListingCard` is built for a photo-forward selling card, not a request card — would need a second component for a section the spec never asked for.
- **"I have this" / "Your request" buttons on Wanted feed cards (`MartRequestCard`) both just open the Wanted Detail screen for now**, same as tapping the card. The real behaviors — opening the Offer sheet, and navigating to "My Ads > Wanted" — depend on Step 2.2 (Offers) and a Wanted tab on My Ads, neither built yet. Detail's own sticky "I have this" button is the one that's honestly stubbed "Coming soon," consistent with every other not-yet-built action this build.
- **My Ads and Filters stay Selling-only this step**, even though `my-ads.ts`'s backend was already fully wanted-aware since Step 1.6. Step 2.1's own "Done when" check (`05-build-plan.md`) only requires posting, the Wanted feed, and `matchesYou` — not a My Ads Wanted tab or Wanted-aware Filters UI. Revisit when Step 2.2 (Offers list is entered via "My Ads > Wanted") needs it.
- **Filters screen's Price fields can theoretically leak into Wanted mode's budget-overlap filter** if a tester sets a Selling price filter, then switches to Wanted without clearing it (the backend already treats the same `priceMin`/`priceMax` params as budget overlap for `type=wanted`, by original design). Known, low-probability edge case given Filters stays Selling-only this step — not fixed now, would be resolved naturally once Filters gets Wanted-awareness.

---

## 2026-10-11 — Milestone 1 Step 1.9: Push for messages

- **`mart_message` rows go into the existing, shared `AppNotification` table with no
  type filter on the existing `/notifications` route** — meaning they're currently
  visible in the app's main (non-Mart) Notifications screen and count toward the main
  Vehicles-tab bell too. `03-api.md` §9 only promises the existing route's *code* stays
  untouched, and Mart's own separate, filtered notification center
  (`GET /mart/notifications`) is explicitly Milestone 2 Step 2.9 — not built yet.
  Flagged clearly to Vikum directly, not just here, since it's a real (if low-risk and
  currently self-limiting to beta phones messaging each other) visible change to an
  existing shared screen.
- **`mart_wanted`/`mart_rating` notification-settings switches exist now with no real
  trigger behind them yet** — `03-api.md` §23 point 21 explicitly asks for all three
  switches in this step, even though Wanted (2.1) and Ratings (2.5) aren't built.
- **si translations added for the 3 new switches now (matching this screen's existing
  full-i18n convention); ta left as the existing English-fallback gap** — this is an
  existing, shared, already-fully-translated screen gaining 3 rows, not new Mart-only
  UI, so it follows ITS established convention (full i18n immediately) rather than
  Mart's own "plain English until Step 3.7" rule, which only applies to genuinely new
  Mart-specific screens.

---

## 2026-10-11 — Milestone 1 Step 1.8: Chat (mobile)

- **One `ChatThreadScreen` handles both a brand-new "draft" conversation and an
  existing thread**, switching entirely on whether local `threadId` state is still
  null, rather than two separate screens or a parent-driven navigation swap. Detail's
  "Message Seller" already resolves which case applies via the `myThreadId` field
  built in Step 1.4, so the draft snapshot it hands over is enough for the pinned bar
  to render with zero extra network round-trips before the thread exists.
- **The confirm-purchase banner and `canRate` plumbing are fully coded now even though
  they're unreachable** (dealState is always null until Mark Sold ships at Milestone 2
  Step 2.4) — same reasoning applied throughout this build to backend-ahead-of-UI
  pieces, just on the mobile side this time: correct dead code beats a TODO that
  someone has to remember to come back and write later.
- **Send failures show one inline error line, not a per-message retry UI** — the typed
  text stays in the compose box either way (nothing is lost), so a simple error banner
  covers the same practical need as the mockup's fuller retry affordance.

---

## 2026-10-11 — Milestone 1 Step 1.8: Chat (backend)

- **`mart_message` notification rows and push are NOT created by `POST /mart/threads`
  or `POST /:threadId/messages` in this step** — the build plan's own table lists
  "mart_message notification + push" as Step 1.9's deliverable, separate from Chat
  itself. Sending a message fully works (thread/message rows, previews, unread
  tracking); only the notification side is deferred one step, deliberately, not missed.
- **Thread visibility (the 7-day closed-window rule) and the blocked-pair exclusion are
  computed in application code, not a single Prisma `where` filter** — the window rule
  needs the *minimum* of two possibly-null date columns, and the blocked check needs to
  know which side of each row is "the other person" (it varies per row), neither of
  which Prisma can express declaratively. Extracted as a pure, exported
  `isThreadListingVisible()` so the logic is unit-tested directly rather than trusted
  blind.
- **A removed listing's title/thumbnail in the inbox fall back to the snapshot taken at
  thread creation; an active-but-sold listing still shows its live, current title** —
  read literally from `03-api.md` §8's own wording ("Snapshot title/thumb are used if
  the listing is removed"), which only mentions the removed case.

---

## 2026-10-11 — Milestone 1 Step 1.7: Favorites

- **Backend**: a removed ad's favorite card is deliberately minimal (`id`, `title`,
  `coverUrl`, `unavailable: 'removed'` — no price/seller/condition), unlike a sold ad
  which keeps the full card. The spec text says "removed ads return a minimal card"
  without fully spelling out why; the sensible reading is that a removed ad may have
  been taken down for a reason (policy, report) that the person who favorited it has no
  particular need to see more detail about.
- **Backend**: the favorites list's `count` (the "N saved" header number) is computed
  across **all** favorites regardless of the currently-selected filter chip, but still
  excludes ads from blocked sellers — consistent with the list itself always excluding
  them regardless of filter.
- **Mobile**: tapping a Favorites row for a removed ad just opens Detail like any other
  row, relying on Detail's own existing 404 state (built in Step 1.4) rather than
  special-casing "removed" locally — one source of truth for what "no longer available"
  looks like.
- **Mobile**: the optimistic favorite-toggle logic is implemented independently in
  `MartHomeScreen` and `DetailScreen` rather than extracted into a shared hook — each
  manages a different shape of local state (a card list vs. a single detail object plus
  a similar-ads list), and with only 2-3 call sites total, a shared abstraction wasn't
  worth the indirection yet.

---

## 2026-10-10 — Milestone 1 Step 1.6: My Ads + My Mart

- **`GET /mart/my-ads` lives in its own router file (`myAds.ts`), mounted at
  `/mart/my-ads`** — not nested under `/mart/listings`, because the spec's own path is
  literally `/mart/my-ads` at the root, not `/mart/listings/my-ads`. It still reuses
  `listings.ts`'s exported `buildListingCards()` rather than duplicating that
  enrichment logic a third time.
- **My Mart's "Edit" reuses Step 1.1's `NameDistrictSheet`** (given two new optional
  props, `title`/`continueLabel`, defaulting to the gate's original copy so that call
  site is unaffected) instead of either building a new dedicated screen or leaving
  "Edit" as a stub. It only covers name + district — no photo picker, and no account-
  deletion row, both of which stay part of the full Edit screen deferred to Milestone 3
  (Step 0.13's existing decision).
- **Favorites, Followings and Reviews rows on My Mart are "Coming soon"** — unlike My
  Ads (which has a real backend and real counts already), none of these three has any
  backend data source yet (Steps 1.7, 2.8, 2.7 respectively), so showing a real count
  with no way to actually open the list would be more confusing than an honest stub.
- **Mark Sold and Relist on My Ads are "Coming soon"**; Mark Reserved/Available and
  Delete are real. Both stubs wait on Mark Sold (Milestone 2 Step 2.4) — Relist only
  makes sense once there's a concept of "sold with a buyer" to relist away from.

---

## 2026-10-10 — Milestone 1 Step 1.5: Edit via the posting screen (mobile)

- **Detail's "Edit" button passes its already-loaded `ListingDetail` object straight
  into `PostAdScreen`'s new `editing` prop**, rather than having `PostAdScreen` fetch the
  listing again by id — it was already fetched once to render Detail; no reason to ask
  the server for the same data twice.
- **A saved edit replaces the `postAd` stack entry with `detail`**, exactly like a fresh
  post does — Back from the (possibly now-updated) Detail page goes to whatever screen
  opened the form, not back into the submitted form itself.

---

## 2026-10-10 — Milestone 1 Step 1.5: Edit, status, delete (backend)

- **`PATCH` validates by merging the request body over the listing's current values and
  re-running `validateListingCreate()`** rather than writing separate "can this field be
  null" PATCH-specific rules. Since that function already fails selling listings with no
  `price`/`make`/etc., the exact same call correctly rejects nulling out a required
  field on edit, for free, with zero new validation code.
- **Reserve/Available and Delete are backend-only for now — not wired into any mobile
  screen in this step.** `04-screens.md` §3's own Detail "own ad" state only ever shows
  Edit and Mark Sold, not a status toggle or delete; the designed home for those two
  actions is explicitly "My Ads menus" (`03-api.md`/build plan), which is Step 1.6. Rather
  than inventing a UI for them that isn't in the design, they stay fully built and
  verified server-side now and become reachable from the app once My Ads exists.

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
