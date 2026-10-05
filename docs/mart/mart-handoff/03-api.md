# Vocksy Mart — 03 API

Part of the developer package. Field names, limits and status values come from `02-data-model.md` (it wins on any disagreement). Screen behavior is in `04-screens.md`.

---

## 0. Global rules

**Base:** same Express app. All Mart routes are under `/mart/...`. Plus `GET /app-config` and `GET /admin/reports`. No existing route changes behavior, except `POST /uploads/photo` gets an optional `folder` field. (Push-token clearing is internal to `sendPush`, section 13.)

**Files:** create `backend/src/routes/mart/` with one router per area (`listings.ts`, `threads.ts`, `sellers.ts`, `social.ts`, `safety.ts`, `notifications.ts`, `me.ts`, `wanted.ts`), mounted in one `martRouter` in `backend/src/routes/mart/index.ts`: `app.use('/mart', authMiddleware, martGate, martRouter)`.

**Auth:** every `/mart` route uses the existing `authMiddleware` (`req.phoneNumber`). No Mart route is public.

**`martGate` middleware (beta gate):** `MART_BETA_PHONES` env = comma list of phones (normalized). Empty or unset = everyone allowed. If set and the caller is not in it → `404 { error: "Not found" }` (look like the route does not exist).

**`requireProfile` middleware** (on write routes that say "needs profile"): caller must have `displayName` and `district` → else `400 { error: "Add your name and district first", code: "PROFILE_REQUIRED" }`.
**`requireRules` middleware** (on `POST /mart/listings`, `PATCH /mart/listings/:id`, sending a message, sending an offer): `martRulesAcceptedAt` and `martRulesVersion === MART_RULES_VERSION` → else `403 { error: "Please accept the Mart rules", code: "RULES_REQUIRED" }`. Applies to post/edit-create, send message, send offer. Reading never needs it.

**IDs in URLs:** `:listingId`, `:threadId`, `:messageId` are cuids. People are `:sellerId` = `User.id`. **Phone numbers never appear in a URL or a response about someone else.** Resolve `sellerId → phone` with one `user.findUnique({ where: { id } })`; unknown → 404.

**IDOR rule (copy the existing pattern):** every query on a thing the caller owns includes the owner in `where` (`{ id, ownerPhone: req.phoneNumber! }`). Thread access: `OR: [{ownerPhone: me}, {otherPhone: me}]`. Return 404 (not 403) when the row exists but is not yours.

**Blocks (server enforced):** build `blockedSet(me)` = phones I blocked ∪ phones that blocked me (one query, both columns). Use it to: hide ads of those people from feed/search/similar/seller pages; refuse to open or send in threads with them (`403 { error: "You can't message this user", code: "BLOCKED" }` — same message either direction so the blocked person learns nothing); skip them in alerts. Existing threads with a blocked person disappear from the inbox while blocked and **return after unblock**. Follows do not return after block.

**Pagination:** lists accept `?cursor=<opaque>&limit=<n>` (default 20, max 50) and return `{ items: [...], nextCursor: string | null }`. Cursor = base64url of `JSON.stringify({ t: <ISO date or number>, id })`. Query: order by (`sortField desc, id desc`); fetch `limit + 1`; if extra row exists, `nextCursor` = last returned row. Invalid cursor → 400.

**Errors:** `{ error: string, code?: string }`. Codes: `PROFILE_REQUIRED`, `RULES_REQUIRED`, `BLOCKED`, `NOT_A_SHOP`, `OFFER_EXISTS`, `ALREADY_REPORTED`, `ALREADY_RATED`, `LISTING_CLOSED`, `NOT_FOUND`, `RATE_LIMITED` (429, existing `checkRateLimit` message), `VALIDATION` (400). Status codes: 400 validation, 401 auth, 403 forbidden, 404 not found/hidden, 409 conflict, 429 rate limit.

**Money:** whole LKR integers. **Dates:** ISO strings from `Date`. **Never** include `ownerPhone`, `dealPartnerPhone`, or any phone in responses (except `contactPhone` of a Shop, section 7).

**Rate limits:** `checkRateLimit(scope, key=req.phoneNumber, max, windowMs)` with values from `MART_RATE_LIMITS` (02 §8.1). Scope names: `mart-post`, `mart-edit`, `mart-msg`, `mart-offer`, `mart-upload`, `mart-report`, `mart-social`, `mart-rate`, `mart-search`.

### Shared response shapes

```ts
type Seller = {
  id: string                 // User.id (sellerId)
  name: string               // publicName(): Shop = full name; Casual = "Kasun P."
  tag: 'shop' | 'casual'
  photoUrl: string | null    // shop logo, else User.profilePhotoUrl
  district: string | null
  rating: { avg: number | null, count: number }   // parts rating
  verified: boolean          // Garage.verified (only for garage-owner shops), else false
}
type ListingCard = {         // feed, search, similar, favorites, seller ads
  id: string; type: 'selling' | 'wanted'
  title: string; coverUrl: string | null
  price: number | null                       // selling
  budgetMin: number | null; budgetMax: number | null   // wanted
  condition: 'new' | 'used' | null
  district: string
  make: string | null; model: string | null
  status: string                              // available | reserved | sold | open | fulfilled
  postedAt: string
  isFavorited: boolean
  seller: Pick<Seller, 'id'|'name'|'tag'|'rating'> & { townAddress?: string | null }
  yearFrom: number | null; yearTo: number | null
  categoryId: string
  statusChangedAt: string; closedAt: string | null
  repliesCount?: number                       // wanted cards, owner's My Ads only
  matchesYou?: boolean                        // wanted cards only
}
type ListingDetail = ListingCard & {
  description: string | null
  categoryId: string; categoryTypeId: string | null
  yearFrom: number | null; yearTo: number | null
  deliveryAvailable: boolean
  photoUrls: string[]
  statusChangedAt: string; closedAt: string | null
  favoritesCount: number | null               // owner only
  offersCount: number | null                  // wanted, owner only: threads with an offer
  newOffersCount: number | null               // wanted, owner only: offer threads with an unread message for the owner
  seller: Seller & { activeAdsCount: number }
  isOwner: boolean
  myThreadId: string | null                   // existing thread with this ad, if any
  myOfferThreadId: string | null              // wanted: my thread where I already sent an offer
  deal: null | { state: 'pending' | 'confirmed' | 'declined', iAmPartner: boolean, outside: boolean, canRate: boolean }
}
```
`deal` is returned only to the owner and to the partner (null for everyone else). The owner sees `state: 'pending'` forever after a decline (a decline is never revealed). The partner who declined sees `state: 'declined'` and no banner.

---

## 1. App config

### `GET /app-config` (auth optional — works before login, no gate)
Response: `{ minVersion: null, martEnabled: boolean, martSupportWhatsapp: string | null }`
- `martEnabled`: if the request has a valid token → true when caller passes the beta gate; no token → `MART_BETA_PHONES` empty. 
- `martSupportWhatsapp` comes from the server env `MART_SUPPORT_WHATSAPP` (null when empty; the app hides the Customer Service row).
- `minVersion` stays `null` in Phase 1 (placeholder so the app can add a force-update screen later).
- The app reads this on launch and after login; hides the Mart tab when `martEnabled` is false. Failure → treat as `martEnabled: false`.

---

## 2. Me (profile for Mart)

### `GET /mart/me`
Response (additional fields for My Mart: `photoUrl`, `rating {avg,count}`, `serviceRating {avg,count}|null`, and `counts` also has `available`, `reserved`, `sold`, `favorites`, `reviews`, `blocked`):
```json
{ "id": "...", "displayName": "Kasun Perera" | null, "district": "colombo" | null,
  "rulesAccepted": true, "rulesVersion": 1, "currentRulesVersion": 1,
  "tag": "casual", "hasGarage": false, "hasShopProfile": false,
  "counts": { "activeAds": 2, "unreadThreads": 1, "unreadNotifications": 3, "followings": 4 } }
```
`rulesAccepted` = accepted AND `martRulesVersion === MART_RULES_VERSION`.

### `PATCH /mart/me`
Body: `{ displayName?, district?, profilePhotoUrl? }` (`profilePhotoUrl` must be an R2 `mart-photos` URL). Validated per 02 §4.7. Rate scope `mart-misc`. Returns the same as `GET /mart/me`.

### `POST /mart/rules/accept`
Body: `{ version: number }` — must equal `MART_RULES_VERSION` else 400. Sets `martRulesAcceptedAt = now`, `martRulesVersion = version`. Returns `{ ok: true }`.

### `DELETE /mart/me` — see section 12 (account deletion).

---

## 3. Photos

### `POST /uploads/photo` (existing route, extended)
Multipart as today, plus form field `folder` = `mart` (optional). Whitelist: only `mart` is accepted besides the default; any other value → 400.
- With `folder=mart`: key becomes `mart-photos/<sha256(phone)[0:16]>/<uuid>.<ext>`; rate limit scope `mart-upload` (120/hour) instead of the service-photos scope.
- Everything else unchanged (5 MB, magic bytes, jpeg/png/webp).
- Response unchanged: `{ url }`.
The app uploads **one photo per request** (sequentially, with retry) after resizing to 1280 px wide at quality 0.7. The listing is created only after all uploads succeed. Orphan uploads are acceptable in Phase 1.

---

## 4. Listings

### `POST /mart/listings` — needs rules + profile
Body (selling): `{ type:"selling", title, description?, categoryId, categoryTypeId?, condition, make, model?, yearFrom?, yearTo?, price, district, deliveryAvailable?, photoUrls }`
Body (wanted): `{ type:"wanted", title, description?, categoryId, categoryTypeId?, make?, model?, yearFrom?, yearTo?, budgetMin?, budgetMax?, district, photoUrls? }`
Validation: 02 §4.1. Rate limit `mart-post`.
Response `201`: `{ id }`. Wanted: after the response is sent, run wanted match alerts (02 §7.3) in the background; failures are logged, never returned.

### `GET /mart/listings` — the feed (Selling) 
Query: `type=selling` (default) | `wanted`, `q?`, `categoryId?`, `categoryTypeId?`, `make?`, `model?`, `yearFrom?`/`yearTo?` (an ad matches when its year range overlaps `[yearFrom, yearTo]`, i.e. `ad.yearFrom <= f.yearTo AND ad.yearTo >= f.yearFrom`, or the ad has no range; if only one is sent use it for both), `condition?` (`new`|`used`), `priceMin?`, `priceMax?` (selling) / budget overlap (wanted), `district?` (one id), `sort?` = `newest` (default) | `price_asc` | `price_desc`, `cursor?`, `limit?`.
Rules:
- Base `where`: `type`, active status, `removedAt: null`, owner not in `blockedSet`.
- `q`: split on spaces; every word must match `title` OR `description` OR `make` OR `model` (`contains`, case-insensitive) OR the label/keywords of the category (`martCategories`) which maps to `categoryId` IN list. Max 6 words, each max 40 chars. Also upserts `MartSearchHistory` (term lower-cased, trimmed; keep newest 30; skip for empty `q`).
- `make`/`model` filter by `makeNorm`/`modelNorm = normalizeVehicleText(value)`; ads with null `makeNorm` or null `modelNorm` (fits any) are also returned when that filter is given. For wanted: budget overlap treats an open budget (both null) as always overlapping, and `price_*` sorts by `budgetMax` (nulls last).
- Sort: `newest` = (`postedAt desc, id desc`); `price_asc`/`price_desc` = (`price`, `id`) with cursor `t` = price; the cursor comparison flips for ascending sort.
Response: `{ items: ListingCard[], nextCursor }`. Use one `groupBy` for seller ratings and one `user.findMany`/`garage.findMany` for tags per page (no N+1). Rate limit `mart-search` when `q` present.

### `GET /mart/listings/count`
Same query params as the feed (without cursor/limit). Response `{ count }`. Used by the "Show N results" button in Filters. Cap with `take`-less `count` — acceptable at this scale.

### `GET /mart/listings/:listingId`
Returns `ListingDetail`. Visibility per 02 §3.4; hidden → 404 `{ error: "This ad is no longer available", code: "NOT_FOUND" }`. Owner always sees own ad (not if removed → 404). Blocked relationship → 404.

### `PATCH /mart/listings/:listingId` — owner, needs rules + profile
Partial update: only sent fields change; required fields cannot be set to null; all rules of 02 §4.1 re-validated on the merged result. Editable fields = create fields except `type`. Rules in 02 §4.1 (cannot edit sold/fulfilled/removed). Rate scope `mart-edit`. Returns `{ ok: true }`. Photo changes: send the full new `photoUrls` array.

### `DELETE /mart/listings/:listingId` — owner
Soft delete: `removedAt = now`. Returns `{ ok: true }`. Idempotent.

### `POST /mart/listings/:listingId/status` — owner
Body `{ status: "reserved" | "available" }` (selling only; from available↔reserved only). Wanted ad or any other transition → 409 `{ code: "VALIDATION" }`. Returns `{ ok: true }`.

### `POST /mart/listings/:listingId/mark-sold` — owner
Selling and wanted use the same route (wanted = "Mark fulfilled").
Body: `{ partnerThreadId?: string, outside?: boolean }` — exactly one: either a thread of this ad (partner = the other participant) or `outside: true`.
- Validates ad is active; thread belongs to this ad and the caller is `ownerPhone`; the partner is not blocked.
- Sets fields per 02 §3.1/3.2. If a partner: notify them (`mart_sale_confirm`) and insert a `system` message (`systemCode: "sold"` / `"fulfilled"`) in that thread.
Both or neither of `partnerThreadId`/`outside` → 400 `VALIDATION`. Ad already sold/fulfilled/removed → 409 `LISTING_CLOSED`. Rate scope `mart-misc`. Returns `{ ok: true }`.

### `GET /mart/listings/:listingId/buyers` — owner
Who can be picked in the "Who bought it?" sheet. Response: `{ items: [{ threadId, name, photoUrl, lastMessageAt, lastMessagePreview, messageCount, canRate: boolean }] }` (`canRate` = both participants have sent a message, 02 §4.6) — threads of this ad with ≥ 1 message, not hidden, not blocked. For wanted ads these are the sellers who answered.

### `POST /mart/listings/:listingId/relist` — owner
Sold/fulfilled → active (otherwise 409 `VALIDATION`). Rules in 02 §3. Rate scope `mart-edit` (relist resets `postedAt`, so it works like a bump). Returns `{ ok: true }`.

### `POST /mart/listings/:listingId/deal/confirm` — partner
Body `{ confirm: boolean }`. Caller must equal `dealPartnerPhone` (anyone else → 404) and `dealState === "pending"` (else 409). `confirm: false` creates no notification and no system message. `true` → `dealState = "confirmed"`, `dealDecidedAt = now`, notify the owner (`mart_sale_confirmed`), insert system message `deal_confirmed`. `false` → `dealState = "declined"`, no notification, no message. Returns `{ ok: true, canRate: boolean }`.

### `POST /mart/listings/:listingId/rate` — rater
Body `{ rating: 1..5, comment? }`. Rules 02 §4.6. Rate limit `mart-rate`. Creates `MartSellerRating`, notifies the seller (`mart_rating`). Returns `201 { ok: true }`. Errors: non-rater → 404; deal not confirmed → 403; 409 `ALREADY_RATED`; 400 with `code: "NOT_ENOUGH_CHAT"` when the both-participants-messaged guard fails (app shows "Chat with the seller before rating"). Store `listingTitle` from the ad.

### `GET /mart/listings/:listingId/more-from-seller`
Response `{ items: ListingCard[] }` (max 10 active ads of the same owner, excluding this ad). Powers the "MORE FROM <seller>" strip in the chat thread; hide the strip when I am the seller. Build in step 1.4.

### `GET /mart/listings/:listingId/similar`
Response `{ items: ListingCard[] }` (max 10) per 02 §6.

### `GET /mart/my-ads`
Query: `type=selling|wanted`, `tab=available|reserved|sold` (wanted: `open|fulfilled`; `active` = available+reserved / open, kept as an alias), `cursor`. Returns the caller's ads (not removed). Active tab = active statuses, sold tab = sold/fulfilled with `closedAt` within the last **90 days** (older ones still stay in the database but are not listed). Items are `ListingCard` plus `{ favoritesCount, chatsCount, repliesCount, dealState, partnerName | null }`. Plus `counts`: `{ available, reserved, sold }` (wanted: `{ open, fulfilled }`) in the response as `{ items, nextCursor, counts }`.

---

## 5. Wanted extras

### `GET /mart/listings/:listingId/offers` — request owner
Response `{ items: [{ threadId, seller: Seller, offerPrice, note, photos, createdAt }], closed: boolean }`. Offers = `MartMessage kind=offer` in threads of this ad. Read-only after fulfilled (visible 7 days).

### `POST /mart/listings/:listingId/offer` — seller, needs rules + profile
Body `{ price?, note?, photos? }` (02 §4.3). Creates (or finds) the thread with the caller as `otherPhone`, inserts an `offer` message, updates thread preview, notifies the owner. Rate limit `mart-offer`.
Response `201 { threadId }`. If already offered: `409 { code: "OFFER_EXISTS", threadId }`.
Not allowed on own request (400 `VALIDATION`), closed request (409 `LISTING_CLOSED`), removed or invisible (404 `NOT_FOUND`), blocked (`BLOCKED`).

---

## 6. Favorites

- `POST /mart/favorites` body `{ listingId }` → `{ ok: true }` (idempotent via the unique pair; listing must be visible; rate scope `mart-fav`).
- `DELETE /mart/favorites/:listingId` → `{ ok: true }` (idempotent).
- `GET /mart/favorites?filter=all|available|closed&cursor=` → `{ items: (ListingCard & { unavailable: 'sold' | 'removed' | null })[], nextCursor, count }` (`count` = total saved, for the "5 saved" header; `closed` = sold or removed). Includes sold/removed ads (grayed); removed ads return a minimal card (title, cover, `unavailable: 'removed'`). Excludes ads of people in `blockedSet`. Order by `MartFavorite.createdAt desc` (cursor field = that date). Selling and wanted ads are mixed in one list.

---

## 7. Sellers, shops, follows

### `GET /mart/sellers/:sellerId`
Seller public profile. Response:
```ts
{ seller: Seller,
  shop: null | { about, contactPhone, townAddress, websiteUrl, googleMapsUrl, district },   // only for tag shop AND a saved MartShopProfile; contactPhone is the ONLY phone ever returned
  memberSince: string,                      // User.createdAt
  stats: { activeAds: number, soldCount: number, ratingCount: number },
  serviceRating: null | { avg: number, count: number },    // garage service rating, only when the user has a Garage with ≥1 rating
  isFollowing: boolean, isMe: boolean, iBlockedThem: boolean }
```
Blocked-me relationship → 404.

### `GET /mart/sellers/:sellerId/listings?type=selling|wanted&cursor=` → `{ items: ListingCard[], nextCursor }` (active ads only).

### `GET /mart/sellers/:sellerId/reviews?kind=parts|service&cursor=`
- `kind=parts` (default): `{ summary: { avg, count, distribution: { "1": n, "2": n, "3": n, "4": n, "5": n } }, items: [{ id, rating, comment, createdAt, listingTitle }], nextCursor }` — no rater name/phone. The app labels the title "For: <title>".
- `kind=service`: reuse `GET /garages/:id/ratings` logic for the user's garage; same `summary`, items `{ id, rating, comment, createdAt }` (no title); 404 `NOT_FOUND` if no garage.

### Follows
- `POST /mart/follows` `{ sellerId }` → `{ ok: true }` (not yourself; not blocked; rate `mart-social`).
- `DELETE /mart/follows/:sellerId` → `{ ok: true }`.
- `GET /mart/follows?cursor=` → `{ items: [{ seller: Seller, activeAdsCount, newestAdAt }], nextCursor }`.
- `GET /mart/follows/feed?cursor=` → `{ items: ListingCard[], nextCursor }` — active selling ads from followed sellers, newest first. **No screen uses it at launch (04 §18 is a list only); implement it last or skip.**

### Shop profile
- `GET /mart/shop-profile` → `{ eligible: boolean, profile: ShopProfileDTO | null, prefill: { name, contactPhone, district, townAddress, websiteUrl, googleMapsUrl, about } | null }`. `ShopProfileDTO` = the `MartShopProfile` fields of 02 §2 without `ownerPhone`. `prefill` comes from the caller's `Garage` (map the Garage's district/town text to a `DISTRICTS` id by normalized name; no match → null) (village/town → townAddress, aboutBio → about, contactPhone, websiteUrl, googleMapsUrl); only when no profile exists.
- `PUT /mart/shop-profile` body per 02 §4.4 → saves (upsert). 403 `NOT_A_SHOP` if the computed tag is not `shop`. Returns the profile.

---

## 8. Messaging

### `POST /mart/threads` — open (or get) a thread — needs rules + profile
Body: `{ listingId, text: string }`. **The thread is created only on the first send**: "Message Seller" opens a draft chat screen with no `threadId` and the prefilled text; if a thread already exists for me and this ad, `GET /mart/listings/:id` returns `myThreadId` and the app opens it instead. `text` is required (non-empty) when no thread exists yet. The inbox and unread count ignore threads with `lastMessageSenderPhone IS NULL`.
- Selling ad: caller must not be the owner. Wanted: same (sellers open threads on requests only through `/offer`, or by chatting here; both allowed).
- Listing must be visible (02 §3.4) and not closed. Blocked → `BLOCKED`.
- Upsert on (`listingId`, caller). On create, store snapshots (`listingType`, `listingTitle`, `listingThumbUrl`).
- The text is sent as the first message (default "Hi, is this still available?", user-editable). Rate scope `mart-misc` for opening plus `mart-msg` for the message.
Response `{ threadId, created: boolean }`.

### `GET /mart/threads?role=all|buying|selling&cursor=` — inbox
Items: `{ id, listing: { id, type, title, thumbUrl, status: 'active' | 'sold' | 'fulfilled' | 'removed' }, other: { id, name, photoUrl, tag }, lastMessagePreview, lastMessageAt, unread: boolean, role: 'buying' | 'selling' }`.
- `role` mapping: selling ad & I am owner → `selling`; selling ad & I am other → `buying`; wanted ad & I am owner → `buying`; wanted & other → `selling`.
- Filters: not hidden by me; not blocked; closed-window rule (02 §3.4). Snapshot title/thumb are used if the listing is removed.
- Order `lastMessageAt desc`.

### `GET /mart/threads/unread-count` → `{ count }` (threads with unread, same filters; `take` small is fine).

### `GET /mart/threads/:threadId`
Response: `{ thread: { id, role, listing: { id, type, title, thumbUrl, price, budgetMin, budgetMax, status, closed: boolean, removed: boolean, closedAt, removedAt, deal (same shape as ListingDetail.deal), isOwner }, other: { id, name, photoUrl, tag }, canSend: boolean, canRate: boolean, dealBanner: null | 'confirm_sale' | 'rate' }, messages: [...], nextCursor }`
`messages` newest page = last 30 (`createdAt desc` returned, app reverses); `?cursor=<nextCursor>` loads older pages (same cursor style as every list). Each message: `{ id, mine: boolean, kind, body, offerPrice, offerPhotos, systemCode, createdAt }`.
Side effect: none (read marking is its own call).

### `POST /mart/threads/:threadId/messages` — needs rules + profile
Body `{ text }`. Checks 02 §4.2; `canSend` false → 403 `LISTING_CLOSED` or `BLOCKED`. Rate `mart-msg`. Updates thread preview/last fields, un-hides it for the other person (`otherHiddenAt`/`ownerHiddenAt = null` for the *recipient* only), creates/updates the notification (02 §7.1 rule), sends push in the background. Response `201 { message }`.

### `POST /mart/threads/:threadId/read` → `{ ok: true }` — sets my `...ReadAt = now`; also marks matching `mart_message` notifications for this thread as read.

### `DELETE /mart/threads/:threadId` → `{ ok: true }` — sets my `...HiddenAt = now` (one-sided). A new message from the other person clears it for me only.

---

## 9. Notifications (Mart tab bell)

- `GET /mart/notifications?cursor=` → `{ items: [{ id, type, title, body, linkTo (parsed object), read, createdAt }], nextCursor }` (only `mart_` types).
- `GET /mart/notifications/unread-count` → `{ count }`.
- `POST /mart/notifications/read-all` → `{ ok: true }`; `POST /mart/notifications/:id/read` → `{ ok: true }` (own rows only).
Existing `/notifications` routes stay untouched and keep working for old types.
Notification-preference keys: see 02 §1.3 (`PUT /auth/notification-prefs` must accept `mart_message`, `mart_wanted`, `mart_rating`, `garage_reminder`).

---

## 10. Safety

### `POST /mart/reports`
Body `{ targetType: "listing"|"user"|"message", targetId, reason, note? }` (`targetId` for user = `sellerId`). The server resolves `targetPhone`. Rules 02 §4.5. Rate `mart-report`. Saves, then (background) creates a `mart_report_received` notification + push for each phone in `ADMIN_PHONES`. Response `201 { ok: true }`; duplicate → `200 { ok: true, code: "ALREADY_REPORTED" }`.

### Blocks
- `POST /mart/blocks` `{ sellerId }` → `{ ok: true }`. Also deletes my follow on them (and theirs on me). Not yourself.
- `DELETE /mart/blocks/:sellerId` → `{ ok: true }`.
- `GET /mart/blocks` → `{ items: [{ seller: { id, name, photoUrl, tag }, blockedAt }] }`.

### `GET /admin/reports?status=open&cursor=` — admin only
Caller phone must be in `ADMIN_PHONES` else 404. Response items: `{ id, targetType, targetId, reason, note, status, createdAt, reporter: { id, name }, target: { title?, ownerName?, ownerId? }, openReportsForTarget: number }`. Phones are never returned. Also `POST /admin/reports/:id/reviewed` → `{ ok: true }` and (approved) `POST /admin/mart/listings/:id/remove` → sets `removedAt`. Admin actions on accounts are manual (SQL) in Phase 1.

### Search history
- `GET /mart/search-history` → `{ items: [{ term }] }` (newest 10). No UI at launch (data is kept for the Phase 2 For You feed); implement last or skip.
- `DELETE /mart/search-history` → clear all; `DELETE /mart/search-history/:term` → one.

---

## 11. Constants endpoint (none)
Categories, districts, vehicle catalog and rules text are constants **in the app** and **in the backend** (02 §8). No `/mart/constants` route. Keep ids identical.

---

## 12. Account deletion
`DELETE /mart/me` is **not** separate; implement the app-wide `DELETE /auth/account` (in-app "Delete my account", with a typed confirmation) that runs the extended `deleteAccount` logic (02 §10) and also clears the push token. It deletes in one transaction; returns `{ ok: true }`; the app then signs out.

---

## 13. Push token hygiene (Step 0 task)
`sendPush`: when Expo returns `DeviceNotRegistered` for a token, set that user's `pushToken = null`. Today dead tokens stay forever.

---

## 14. Endpoint index

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /app-config | optional | no gate |
| GET/PATCH | /mart/me | yes | |
| POST | /mart/rules/accept | yes | |
| POST | /uploads/photo | yes | `folder=mart` |
| POST | /mart/listings | yes | rules+profile |
| GET | /mart/listings | yes | feed/search |
| GET | /mart/listings/count | yes | |
| GET/PATCH/DELETE | /mart/listings/:listingId | yes | |
| POST | /mart/listings/:listingId/status \| mark-sold \| relist \| deal/confirm \| rate \| offer | yes | |
| GET | /mart/listings/:listingId/similar \| buyers \| offers | yes | |
| GET | /mart/my-ads | yes | |
| POST/DELETE/GET | /mart/favorites | yes | |
| GET | /mart/sellers/:sellerId \| /listings \| /reviews | yes | |
| POST/DELETE/GET | /mart/follows, GET /mart/follows/feed | yes | |
| GET/PUT | /mart/shop-profile | yes | |
| POST/GET/DELETE | /mart/threads … | yes | |
| GET/POST | /mart/notifications … | yes | |
| POST/GET/DELETE | /mart/reports, /mart/blocks | yes | |
| GET/DELETE | /mart/search-history | yes | |
| GET/POST | /admin/reports … | admin | |
| DELETE | /auth/account | yes | |
