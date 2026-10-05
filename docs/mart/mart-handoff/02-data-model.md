# Vocksy Mart — 02 Data Model

Part of the developer package. Read `01-product-spec.md` first for what Mart is, and `00-README.md` for reading order. This file is the **single source of truth for the database and the rules that live in it**. If another file disagrees with this one about a field name, a status value or a limit, this file wins (and tell Vikum).

Status: 2026-10-05. All decisions in here are confirmed unless marked **(proposed)**.

---

## 0. How to use this file

- The database is Postgres (Neon, free tier) through Prisma 6. Schema file: `backend/prisma/schema.prisma`. Changes go out with `prisma db push` (no migrations folder exists). **Every change in this file is additive** (new tables, new nullable or defaulted columns). Nothing existing is renamed, retyped or removed. See section 9 for the safe rollout steps.
- Follow the existing code conventions (from the tech reference): ids are `cuid()`, statuses are plain `String` with a default (no Prisma `enum`), no zod (manual checks), errors `{ error: "..." }`, text caps with `capText`.
- **People are identified by phone number inside the database** (`ownerPhone`, `buyerPhone`, ...). **The phone number must never appear in an API URL or in an API response about another person.** The public id of a person is `User.id`, called `sellerId` in the API (see `03-api.md`).
- Mart tables do NOT declare Prisma relations to `User` (this avoids adding back-relation fields to the `User` model). Look people up with one batched query: `prisma.user.findMany({ where: { phoneNumber: { in: phones } } })`. Relations between Mart tables themselves (listing → messages etc.) are declared normally with `onDelete: Cascade`.
- No Mart model name clashes with the 17 existing models (checked).

---

## 1. Changes to existing tables

### 1.1 `User` — four new optional columns
```prisma
model User {
  // ...all existing fields stay exactly as they are...
  displayName         String?    // shown to other people, e.g. "Kasun Perera". 2–40 chars, trimmed
  district            String?    // district id, e.g. "colombo" (see section 8.2)
  martRulesAcceptedAt DateTime?  // when the user ticked the Mart rules checkbox
  martRulesVersion    Int?       // which version of the rules text they accepted
}
```
- Asked once, at the first Mart action that needs them (first post, first message, first offer). Reused by the whole app later.
- Public display name rule: show `displayName` as the user typed it for Shops; for Casual sellers show **first name + last initial** ("Kasun P."), computed in the API (`publicName()`), never stored.
- If `displayName` is empty for an old user, the API returns the name as "Vocksy user" and the app asks for a name at the first Mart action.

### 1.2 `AppNotification` — one new index (optional but recommended)
```prisma
model AppNotification {
  // ...existing fields...
  @@index([userPhone, createdAt])
}
```
Mart adds a lot of notifications; the Mart list filters by `type startsWith "mart_"`.

### 1.3 Notification preferences (`User.notificationPrefs` JSON string)
Add three keys with default `true`: `mart_message`, `mart_wanted`, `mart_rating`. Also add the existing-but-dropped `garage_reminder`. All of this goes through the new shared `backend/src/utils/notificationPrefs.ts` (Step 0 task), which replaces the 6 duplicated `parsePrefs()` copies and fixes `PUT /auth/notification-prefs` dropping `garage_reminder`.
Which key controls what:
| Key | Controls |
|---|---|
| `mart_message` | new chat message, new offer, sale confirm request, sale confirmed |
| `mart_wanted` | "New request near you" (the Wanted request alerts switch) |
| `mart_rating` | "left you a review" |

---

## 2. New tables (complete Prisma schema)

Add all of this to `schema.prisma`. Comments are part of the spec.

```prisma
// ───────────────────────── Listings ─────────────────────────
model MartListing {
  id                String   @id @default(cuid())
  type              String   @default("selling")   // selling | wanted
  ownerPhone        String                          // the seller (selling) or the requester (wanted)
  title             String                          // 1–100 chars
  description       String?                         // max 3000 (LONG_TEXT_LEN)
  categoryId        String                          // id from MART_CATEGORIES, e.g. "brakes"
  categoryTypeId    String?                         // e.g. "brake_pads"; null = "All <category>" or "other"
  condition         String?                         // new | used   (selling only; null for wanted)
  make              String?                         // exactly as picked, e.g. "Toyota"
  model             String?                         // e.g. "Axio"
  makeNorm          String?                         // normalizeVehicleText(make)  — for matching
  modelNorm         String?                         // normalizeVehicleText(model)
  yearFrom          Int?
  yearTo            Int?                            // yearFrom <= yearTo; both null = fits all years
  price             Int?                            // LKR whole rupees. selling only, required there
  budgetMin         Int?                            // wanted only
  budgetMax         Int?                            // wanted only (required for wanted if budget given)
  district          String                          // district id
  deliveryAvailable Boolean  @default(false)        // selling only, informational
  photoUrls         String[]                        // R2 urls, order = display order, [0] = cover. Selling 1–8, wanted 0–8

  status            String   @default("available")  // selling: available | reserved | sold
                                                    // wanted:  open | fulfilled
  postedAt          DateTime @default(now())        // used for sort + "Posted 3 days ago"; reset by Relist
  statusChangedAt   DateTime @default(now())        // "Reserved 1 day ago", "Sold 2 days ago"
  closedAt          DateTime?                       // set when status becomes sold / fulfilled; cleared by Relist
  removedAt         DateTime?                       // soft delete by the owner ("Removed"); NEVER hard-deleted (reports need it)

  // The deal (who bought / who sold). Same fields for selling and wanted.
  dealPartnerPhone  String?                         // selling: the buyer picked by the seller
                                                    // wanted:  the seller picked by the requester
  dealOutside       Boolean  @default(false)        // true = "Sold outside Vocksy" / "Got it outside Vocksy"
  dealState         String?                         // null | pending | confirmed | declined
  dealDecidedAt     DateTime?                       // when partner confirmed or declined

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  favorites         MartFavorite[]
  threads           MartThread[]
  ratings           MartSellerRating[]

  @@index([type, status, removedAt, postedAt])
  @@index([ownerPhone, type, status])
  @@index([categoryId, makeNorm])
  @@index([district])
  @@index([dealPartnerPhone])
}

// ───────────────────────── Favorites ─────────────────────────
model MartFavorite {
  id         String      @id @default(cuid())
  userPhone  String
  listingId  String
  createdAt  DateTime    @default(now())
  listing    MartListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([userPhone, listingId])
  @@index([userPhone, createdAt])
  @@index([listingId])
}

// ───────────────────────── Messaging ─────────────────────────
// One thread per (listing, other person). "owner" = listing owner, "other" = the other participant.
//   selling: owner = seller, other = buyer
//   wanted:  owner = requester (the buyer), other = the seller who answered
model MartThread {
  id                    String      @id @default(cuid())
  listingId             String
  ownerPhone            String
  otherPhone            String
  listingType           String                         // snapshot: selling | wanted
  listingTitle          String                         // SNAPSHOT at creation (survives removal)
  listingThumbUrl       String?                        // SNAPSHOT of photoUrls[0] at creation
  lastMessageAt         DateTime    @default(now())
  lastMessagePreview    String      @default("")       // first 80 chars, "Photo offer" etc.
  lastMessageSenderPhone String?
  ownerReadAt           DateTime?                      // when the owner last opened the thread
  otherReadAt           DateTime?
  ownerHiddenAt         DateTime?                      // one-sided delete by the owner
  otherHiddenAt         DateTime?                      // one-sided delete by the other person
  createdAt             DateTime    @default(now())
  listing               MartListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  messages              MartMessage[]

  @@unique([listingId, otherPhone])
  @@index([ownerPhone, lastMessageAt])
  @@index([otherPhone, lastMessageAt])
}

model MartMessage {
  id           String     @id @default(cuid())
  threadId     String
  senderPhone  String                                  // for kind "system" = the person who caused it
  kind         String     @default("text")             // text | offer | system
  body         String     @default("")                 // text: max 1000. offer: the note (max 300). system: ""
  offerPrice   Int?                                    // kind offer only
  offerPhotos  String[]                                // kind offer only, max 3
  systemCode   String?                                 // kind system: sold | fulfilled | deal_confirmed  (system lines do NOT change lastMessage* or unread). Texts: "Marked as sold", "Marked as fulfilled", "Purchase confirmed"
  createdAt    DateTime   @default(now())
  thread       MartThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}

// ───────────────────────── Ratings ─────────────────────────
// Was called "SellerRating" in earlier notes. Do NOT reuse GarageRating.
model MartSellerRating {
  id          String      @id @default(cuid())
  listingId   String
  raterPhone  String                                   // the person who gives the rating (the buyer; for a wanted deal: the requester)
  sellerPhone String                                   // the person who is rated (the seller)
  rating      Int                                      // 1..5
  comment     String?                                  // max 500
  listingTitle String                                  // snapshot of the ad title at rating time (shown as "For: <title>")
  createdAt   DateTime    @default(now())
  listing     MartListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([listingId, raterPhone])                    // one rating per sold listing
  @@unique([raterPhone, sellerPhone])                  // one rating per rater–seller pair (anti-abuse, see 4.6)
  @@index([sellerPhone, createdAt])
}

// ───────────────────────── People ─────────────────────────
model MartFollow {
  id            String   @id @default(cuid())
  followerPhone String
  sellerPhone   String
  createdAt     DateTime @default(now())

  @@unique([followerPhone, sellerPhone])
  @@index([followerPhone, createdAt])
}

model MartBlock {
  id           String   @id @default(cuid())
  blockerPhone String
  blockedPhone String
  createdAt    DateTime @default(now())

  @@unique([blockerPhone, blockedPhone])
  @@index([blockedPhone])
}

// ───────────────────────── Trust & safety ─────────────────────────
model MartReport {
  id           String   @id @default(cuid())
  reporterPhone String
  targetType   String                                  // listing | user | message
  targetId     String                                  // listing id, User.id (sellerId) or message id
  targetPhone  String?                                 // owner of the reported thing (resolved by the server). Report phones are kept on purpose (investigation)
  targetTitle  String?                                 // snapshot: listing title (max 200) so reports survive deletion
  targetSnippet String?                                // snapshot: message text (max 200) for targetType message
  reason       String                                  // scam | fake | prohibited | spam | abuse | other
  note         String?                                 // max 300; required when reason = other
  status       String   @default("open")               // open | reviewed
  createdAt    DateTime @default(now())

  @@index([status, createdAt])
  @@index([targetType, targetId])
  @@index([reporterPhone, targetType, targetId, createdAt])
}

// ───────────────────────── Shops ─────────────────────────
model MartShopProfile {
  id            String   @id @default(cuid())
  ownerPhone    String   @unique
  name          String                                  // 1–60
  logoUrl       String?
  about         String?                                 // max 300
  contactPhone  String                                  // public phone/WhatsApp for the contact buttons
  district      String
  townAddress   String?                                 // max 100
  websiteUrl    String?
  googleMapsUrl String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ───────────────────────── Alerts & history ─────────────────────────
// Makes sure one seller is notified at most once per wanted request.
model MartWantedAlert {
  id         String   @id @default(cuid())
  listingId  String                                     // the wanted request
  sellerPhone String
  createdAt  DateTime @default(now())

  @@unique([listingId, sellerPhone])
}

// Stored from day one for the Phase 2 "For You" feed. Keep the last 30 per user.
model MartSearchHistory {
  id        String   @id @default(cuid())
  userPhone String
  term      String                                      // lower-cased, trimmed, max 60
  createdAt DateTime @default(now())                     // updated when the same term is searched again

  @@unique([userPhone, term])
  @@index([userPhone, createdAt])
}
```

**Not tables (on purpose):**
- Categories, category types, districts, vehicle makes/models, rules text: constants in code (section 8).
- Seller tag (Casual/Shop), seller rating average/count, favorites count, chats count, replies count, unread counts: **computed on read** (section 6). No cached columns in Phase 1.
- Notifications: reuse `AppNotification` with `mart_*` types (section 7).
- Saved filters and For You: Phase 2, no table yet.

---

## 3. Status model and transitions

### 3.1 Selling ads (`type = "selling"`)
| From | Action | To | Side effects |
|---|---|---|---|
| (new) | post | `available` | `postedAt = now` |
| `available` | Mark Reserved | `reserved` | `statusChangedAt`. No notification and no system message (only the amber Reserved tag shows) |
| `reserved` | Mark Available | `available` | `statusChangedAt`; no notification, no system message |
| `available` / `reserved` | Mark Sold (with buyer) | `sold` | `closedAt = now`, `dealPartnerPhone = buyer`, `dealState = "pending"`, `dealOutside = false`; notify buyer `mart_sale_confirm`; system message "sold" in that thread; every other open thread of the ad shows the Sold banner automatically (read-time) |
| `available` / `reserved` | Mark Sold (outside) | `sold` | `closedAt = now`, `dealOutside = true`, `dealState = null`; no notification, no rating possible |
| `sold` | Relist | `available` | clear `closedAt`, `dealPartnerPhone`, `dealState`, `dealDecidedAt`, set `dealOutside = false`; `postedAt = now`. Old threads become active again because `closedAt` is cleared (expected: same item relisted). No system message |
| any | Delete | (stays, `removedAt = now`) | soft delete; threads show "Removed" banner |

### 3.2 Wanted ads (`type = "wanted"`)
| From | Action | To | Side effects |
|---|---|---|---|
| (new) | post | `open` | `postedAt = now`; background wanted-match alerts (section 7.3) |
| `open` | Mark Fulfilled (with seller) | `fulfilled` | `closedAt = now`, `dealPartnerPhone = seller`, `dealState = "pending"`; notify that seller `mart_sale_confirm` ("Confirm you sold this") |
| `open` | Mark Fulfilled (outside) | `fulfilled` | `closedAt = now`, `dealOutside = true` |
| `fulfilled` | Repost (the "Relist" action) | `open` | same clearing as selling Relist; `postedAt = now` |
| any | Delete | (stays, `removedAt = now`) | soft delete |

### 3.3 Deal confirmation (`dealState`)
`null` → (`pending` on mark sold/fulfilled with a partner) → `confirmed` or `declined`.
- **Selling:** the partner is the **buyer**. Buyer confirms → `confirmed` → buyer may rate the seller. Buyer says "Not me" → `declined` (seller is not told who declined; the seller only sees no change; no rating).
- **Wanted:** the partner is the **seller**. Seller confirms ("Confirm you sold this") → `confirmed` → the **request owner** may rate the seller. "Not me" → `declined`.
- Who may rate: `raterPhone` = selling → `dealPartnerPhone`; wanted → `ownerPhone`. `sellerPhone` (rated person) = selling → `ownerPhone`; wanted → `dealPartnerPhone`.
- The seller can never change the partner after `dealState` is `confirmed`. While `pending` the owner can re-open the pick by marking sold again? **No.** Once `pending` or `confirmed`, the only way to change is Relist (which clears the deal).

### 3.4 Visibility windows (all computed at read time — NO cleanup job needed)
`const CLOSED_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000`
| Thing | Visible when |
|---|---|
| Ad in the feed / search / similar / seller's ads | `removedAt IS NULL` AND status in (`available`,`reserved`) for selling, `open` for wanted |
| Ad detail page (anyone) | `removedAt IS NULL` AND (status active OR `closedAt > now - 7d`). Otherwise → 404 "This ad is no longer available" |
| Ad detail for the **owner** | any status except removed (removed = 404). Removed ads are not listed in My Ads. My Ads "sold" tab shows ads with `closedAt` within the last 90 days |
| Favorites row | always listed (grayed with label Sold/Removed) until the user removes it; tapping opens detail or "no longer available" |
| Thread in inbox | thread not hidden by me (`ownerHiddenAt`/`otherHiddenAt` null) AND (listing active, OR listing closed/removed less than 7 days ago). Closed time = the earlier of `listing.removedAt` and `listing.closedAt` (whichever are set), so deleting an old sold ad does not restart the 7 days |
| Thread messages | readable while the thread is visible; sending is blocked when the listing is closed (sold/fulfilled), removed, or the pair is blocked |
| Offers list of a fulfilled request | read-only, visible 7 days after `closedAt` |
**Because everything is a date comparison, it is correct even when the Render server was asleep.** Do not build a timer job for this. Rows are never hard-deleted for time (the data stays for report investigation).
After **Relist**, `closedAt` is cleared, so old threads of that ad become active again with the same buyer — acceptable and expected (seller relisted the same item).

---

## 4. Field rules and validation

All validation is manual if-checks in the route (no zod). All free text goes through `capText(value, max)` after `.trim()`. Error shape `{ error: "message" }` plus an optional `code` string for the app (see `03-api.md`).

### 4.1 Listing create / edit
| Field | Rule |
|---|---|
| `type` | `selling` or `wanted`; cannot change on edit |
| `title` | required, 1–100 after trim |
| `description` | optional, max 3000 |
| `categoryId` | required, must exist in `MART_CATEGORIES`; `categoryTypeId` optional but if given must belong to that category; `other` category has no types |
| `condition` | selling: required, `new` or `used`. wanted: must be null (ignore if sent) |
| `make` | required for selling. For wanted optional. Must exist in the vehicle catalog (`vehicleCatalog.ts`) or equal `"Other"` (then `model` is free text, max 40) |
| `model` | optional; if `make` is in the catalog and model is not `"Other"`, must be in that make's model list |
| `yearFrom`, `yearTo` | optional; integers 1950..(current year + 1); both or neither; `yearFrom <= yearTo` |
| `price` | selling: required, integer 1..100,000,000 (`MAX_AMOUNT`). wanted: must be null |
| `budgetMin`, `budgetMax` | wanted only. budget is optional; empty = "Open budget" (both null). If any value is given, `budgetMax` is required; `budgetMin` optional and `<= budgetMax`; both 1..100,000,000. Selling: must be null |
| `district` | required, must be in `DISTRICTS` |
| `deliveryAvailable` | selling only; ignored (false) for wanted |
| `photoUrls` | selling: 1–8; wanted: 0–8; each URL must start with `R2_PUBLIC_URL + "/mart-photos/"` (reject others) |
| Edit rules | owner only; cannot edit a `sold`/`fulfilled` ad (Relist first); cannot edit a removed ad |
| Normalization | on every save set `makeNorm = normalizeVehicleText(make)`, `modelNorm = normalizeVehicleText(model)` |

`normalizeVehicleText(s)`: lowercase → trim → collapse multiple spaces → remove everything after the first `" / "` (so "Vitz / Yaris" becomes "vitz") → remove characters that are not letters, digits or spaces. Used for "Matches you", similar listings and wanted-match alerts. Lives in `backend/src/utils/vehicleText.ts`.

### 4.2 Messages
`body` for text: 1–1000 after trim (empty not allowed). Offer message created only by the offer endpoint. System messages created only by the server. Sending requires: thread visible to me, listing not closed/removed, not blocked either way, rules accepted, `displayName` + `district` set.

### 4.3 Offer
All optional (an empty offer is allowed). `price` 1..100,000,000. `photos` max 3, same R2 prefix rule. `note` max 300. One offer per (request, seller): the unique thread (`listingId`, `otherPhone`) plus a check "no `offer` message by me in this thread yet"; a second attempt returns the existing thread id with `code: "OFFER_EXISTS"`. Cannot offer on your own request, on a closed/removed request, or when blocked.

### 4.4 Shop profile
`name` required 1–60; `contactPhone` required, must pass the existing phone normalizer (`utils/phone.ts`); `district` required; `about` max 300; `townAddress` max 100; `websiteUrl`/`googleMapsUrl` optional, must parse as a URL after prefixing `https://` when missing, and the scheme must be `http` or `https` (reject `javascript:`, `tel:` etc.); `logoUrl` must be an R2 `mart-photos` URL. Only users whose computed tag is `shop` may save (else 403 `code: "NOT_A_SHOP"`).

### 4.5 Report
`reason` one of the six values; `reason = abuse` only for `targetType` `user` or `message`; `note` max 300, required for `other`. Cannot report yourself. Duplicate report on the same target by the same person within 24h is ignored with `code: "ALREADY_REPORTED"` (200, nothing saved).

### 4.6 Rating
- `rating` integer 1..5; `comment` optional, max 500.
- Allowed only when: listing `dealState = "confirmed"` and the caller is the `raterPhone` of section 3.3.
- Anti-fake guard: in the deal's thread **both participants must have sent at least one message** (text or offer; the seller's offer counts as the seller's message). This is reachable even though sending closes when the ad is sold. The "Who bought it?" sheet shows each person's `messageCount` so the seller knows who can rate.
- Unique on (`listingId`, `raterPhone`) and on (`raterPhone`, `sellerPhone`): second attempt → 409 "You already rated this seller". (The pair rule means a repeat customer cannot rate the same seller twice. Decision: keep for launch — it stops rating farming. Revisit if sellers complain.)
- Skip is allowed; the buyer can rate later while the thread is still visible (the app shows a "Rate seller" link). After the thread is hidden (7 days) there is no UI to rate; the endpoint still works if called.
- No edit, no delete.

### 4.7 Display name and district
`displayName` 2–40 chars after trim; allowed characters `[\p{L}\p{M}\p{N} .'-]` (the `\p{M}` is required for Sinhala and Tamil vowel signs). `publicName()`: split on whitespace; one word → that word; more → first word + space + first grapheme of the last word + `.` (use `Intl.Segmenter` or the first code point plus following marks). `district` must be in `DISTRICTS`. Changing the district later is allowed from My Mart > Edit.

---

## 5. Who can see what (privacy rules the API must enforce)

| Data | Visible to |
|---|---|
| Phone number of a **Casual** seller | **nobody** (not in any response). Contact is chat only |
| Phone of a **Shop** | everyone, but only the `MartShopProfile.contactPhone` the owner chose to publish |
| `User.id` (as `sellerId`) | everyone (it is the public id) |
| Display name | everyone (first name + last initial for Casual, full for Shop) |
| Who favorited an ad | nobody. The owner sees only the count |
| Reports (reporter, target, note) | admins in `ADMIN_PHONES` only |
| Blocks | the blocker only. The blocked person is never told; they just stop seeing things |
| Ratings | public: stars, comment, time, the ad title bought. **Not** the rater's name |
| Threads and messages | the two participants only (one-sided delete respected) |
| Offers | the request owner and the offering seller only |
| Decline of a deal | never shown to the other side |
| Search history | the owner only |

---

## 6. Computed values (never stored)

| Value | How to compute | Notes |
|---|---|---|
| **Seller tag** `shop` / `casual` | `shop` if the user has a `Garage` row, OR has ≥ 5 selling ads with `createdAt >= now - 90 days` and `removedAt IS NULL` (sold ads count). Else `casual` | For a page of sellers: one `groupBy` on `MartListing` for the 90-day count + one `findMany` on `Garage` for owner phones. `MIN_SHOP_ADS = 5`, `SHOP_WINDOW_DAYS = 90` |
| **Seller rating** `{avg, count}` | `aggregate` on `MartSellerRating` by `sellerPhone`; avg rounded to 1 decimal (same as `getRatingStats`). `null` avg and 0 count when none | For pages: **one** `groupBy({ by: ['sellerPhone'], _avg, _count, where: { sellerPhone: { in } } })`, never one query per card |
| **Service rating** (garage that sells parts) | existing `getRatingStats(garageId)`. Show only when the garage has ≥ 1 service rating | Never mixed with parts rating |
| **Favorites count** of an ad | `count` on `MartFavorite` by `listingId` | owner sees it in My Ads; page via `groupBy` |
| **Chats count** (selling) / **replies count** (wanted) | `count` on `MartThread` by `listingId` where the thread has ≥ 1 message | |
| **Active ads count** of a seller | count of the seller's ads with active status and `removedAt IS NULL` | shown on Detail seller row ("6 active ads") |
| **Unread thread** (for me) | `lastMessageSenderPhone != me` AND `lastMessageAt > myReadAt (or myReadAt is null)` AND not hidden by me | Messages icon dot = any such thread exists (single query, `take 1`) |
| **Matches you** (request card) | the viewer owns ≥ 1 selling ad (any status, not removed) with the same `categoryId` AND (if the request has `makeNorm`) the same `makeNorm` or ad `makeNorm` is null | Computed for a page with one query on the viewer's distinct (`categoryId`, `makeNorm`) pairs |
| **isFavorited** | one query: `MartFavorite where userPhone = me and listingId in (page ids)` | |
| **Deal banner** for the partner | listing `dealState = "pending"` and caller is `dealPartnerPhone` | |
| **Similar ads** | same `type`, `status` active, not removed, not this ad, not blocked; order: same `categoryId` + same `makeNorm` first, then same `categoryId`; `take 10`. Implement as two queries merged and de-duplicated | |
| **canRate** (can I still rate) | `dealState = "confirmed"`, I am the rater, no `MartSellerRating` with (`listingId`, me), no `MartSellerRating` with (me, this seller), and the both-participants-messaged guard (02 §4.6) passes | |

---

## 7. Notifications (rows in `AppNotification`)

Use the existing `createNotification(prisma, userPhone, type, title, body, linkTo?)` and `sendPush(...)`. Push is sent only when the user's pref key (section 1.3) is not `false` and the user has a `pushToken`. **Always create the in-app row; the pref only controls the push.** Do pushes in the background (never block the request).

### 7.1 Types, text and `linkTo`
| type | When | Title | Body | linkTo object | Pref key |
|---|---|---|---|---|---|
| `mart_message` | new text message | `<publicName>` | the message text (max 80) | `{ screen: "martThread", threadId }` | `mart_message` |
| `mart_message` | new offer on a request | `New offer on your request` | `<seller name> · Rs. X · <request title>` | `{ screen: "martThread", threadId }` | `mart_message` |
| `mart_sale_confirm` | seller picked me as buyer (selling) / requester picked me as seller (wanted) | `<name> marked <title> as sold to you` / `Confirm you sold <title>` | `Tap to confirm your purchase and leave a review.` / `Tap to confirm.` | `{ screen: "martThread", threadId }` | `mart_message` |
| `mart_sale_confirmed` | the partner confirmed | selling: `<name> confirmed the purchase`; wanted: `<name> confirmed the sale` | `<title>` | selling: `{ screen: "martMyAds", tab: "sold" }`; wanted: `{ screen: "martThread", threadId }` (the requester lands in the thread, which shows the Rate banner) | `mart_message` |
| `mart_wanted_match` | a new wanted request matches the seller's past ads | `New request near you` | `<title> · <budget> · <district>` | `{ screen: "martWanted", listingId }` | `mart_wanted` |
| `mart_rating` | someone rated me | `New <n>-star review` (never the rater's name) | the comment or empty | `{ screen: "martReviews" }` (opens My Mart with the Reviews modal for my own `User.id`) | `mart_rating` |
| `mart_report_received` | a report was saved (sent only to `ADMIN_PHONES`) | `New Mart report` | `<reason> · <target title or user name>` | none (`linkTo` null; tapping just opens the Mart notification list). Shown with a flag icon | always |
**One row per thread for messages:** when a new message arrives and an **unread** `mart_message` row already exists for the same `threadId` (match on `linkTo` JSON text), **update that row's body and createdAt instead of creating another** (avoids flooding). Offers and sale rows are always new rows.
`App.tsx` routing (`~725–751`) must get new branches for `martThread`, `martListing`, `martWanted`, `martReviews`, `martMyAds`, `martNotifications` and must also destructure `threadId`, `listingId`, `tab` from the parsed `linkTo` (today it only reads `screen`, `vehicleId`, `bookingId`). An unknown target silently falls back to the vehicle list — test every branch.

### 7.2 Mart notification list and unread count
- List: `AppNotification where userPhone = me and type startsWith "mart_"` order `createdAt desc`, cursor paging.
- Unread count: same filter with `read = false`.
- Mark read: set `read = true` (single or all, only for `mart_` types).

### 7.3 Wanted match alerts (run in the background after a wanted request is created)
1. Candidate sellers = distinct `ownerPhone` of the sellers' ads where `type = "selling"`, `removedAt IS NULL`, `categoryId = request.categoryId`, `createdAt >= now - 12 months`.
2. Remove: the requester; any pair blocked either way; phones already in `MartWantedAlert` for this request. (Users with `mart_wanted = false` still get the in-app row; only the push is skipped.)
3. Rank: same `makeNorm` as the request (when the request has a make) first; then same district; then newest ad. Take **20**.
4. For each: insert `MartWantedAlert` (ignore duplicate error), `createNotification(... "mart_wanted_match" ...)`, push if pref allows.
5. Sellers with no past ad are not alerted at launch (Garage owners without ads included). The Phase 2 specialty picker will widen this.

---

## 8. Constants (code, not database)

Create these files (backend copy and mobile copy must stay identical — keep ids stable forever; add, never rename):
- `backend/src/data/martCategories.ts` and `mobile/src/constants/martCategories.ts`
- `backend/src/data/districts.ts` and `mobile/src/constants/districts.ts`
- `backend/src/data/vehicleCatalog.ts` (copy of the mobile `BRAND_MODELS` plus extra Sri Lankan makes; mark with a comment "duplicate of mobile/src/constants/vehicleData.ts — keep in sync until centralized")
- `backend/src/data/martLimits.ts` (section 8.1)
- `backend/src/data/martRules.ts` and `mobile/src/constants/martRules.ts` (rules text + `MART_RULES_VERSION = 1`; see `04-screens.md`, Mart rules)

### 8.1 Limits and settings (`martLimits.ts`)
```ts
export const MART_LIMITS = {
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 3000,        // = LONG_TEXT_LEN
  MESSAGE_MAX: 1000,
  OFFER_NOTE_MAX: 300,
  REPORT_NOTE_MAX: 300,
  RATING_COMMENT_MAX: 500,
  SHOP_NAME_MAX: 60,
  SHOP_ABOUT_MAX: 300,
  SHOP_ADDRESS_MAX: 100,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 40,
  PHOTOS_SELLING_MAX: 8,
  PHOTOS_WANTED_MAX: 8,
  OFFER_PHOTOS_MAX: 3,
  PRICE_MAX: 100_000_000,        // = MAX_AMOUNT
  YEAR_MIN: 1950,
  PAGE_SIZE: 20,                 // default take for every list
  PAGE_SIZE_MAX: 50,
  CLOSED_VISIBLE_DAYS: 7,
  SHOP_MIN_ADS: 5,
  SHOP_WINDOW_DAYS: 90,
  WANTED_ALERT_MAX_SELLERS: 20,
  WANTED_ALERT_LOOKBACK_MONTHS: 12,
  SEARCH_HISTORY_MAX: 30,
  SIMILAR_MAX: 10,
  MORE_FROM_SELLER_MAX: 10,
  DUPLICATE_REPORT_HOURS: 24,
}
export const MART_RATE_LIMITS = {            // checkRateLimit(scope, key=phone, max, windowMs)
  POST_LISTING:   { max: 10,  windowMs: 60 * 60 * 1000 },
  EDIT_LISTING:   { max: 60,  windowMs: 60 * 60 * 1000 },
  SEND_MESSAGE:   { max: 60,  windowMs: 60 * 60 * 1000 },
  SEND_OFFER:     { max: 30,  windowMs: 60 * 60 * 1000 },
  FAVORITE:       { max: 300, windowMs: 60 * 60 * 1000 },   // scope mart-fav
  MISC_WRITE:     { max: 60,  windowMs: 60 * 60 * 1000 },   // scope mart-misc: PATCH /mart/me, mark-sold, relist, status, POST /mart/threads (open), PUT shop-profile
  UPLOAD_PHOTO:   { max: 120, windowMs: 60 * 60 * 1000 },   // separate scope "mart-upload"
  REPORT:         { max: 10,  windowMs: 24 * 60 * 60 * 1000 },
  FOLLOW_BLOCK:   { max: 100, windowMs: 60 * 60 * 1000 },
  RATE_SELLER:    { max: 20,  windowMs: 60 * 60 * 1000 },
  SEARCH:         { max: 300, windowMs: 60 * 60 * 1000 },
}
```
Reads are covered by the existing global per-IP backstop.

### 8.2 Districts (25) — ids are lowercase English, labels en/si/ta in the constant
`ampara, anuradhapura, badulla, batticaloa, colombo, galle, gampaha, hambantota, jaffna, kalutara, kandy, kegalle, kilinochchi, kurunegala, mannar, matale, matara, monaragala, mullaitivu, nuwara_eliya, polonnaruwa, puttalam, ratnapura, trincomalee, vavuniya`
Shape: `{ id: 'nuwara_eliya', en: 'Nuwara Eliya', si: 'නුවරඑළිය', ta: 'நுவரெலியா' }`. The developer fills si/ta labels; if unsure, use the English label as a placeholder and list them for Vikum to correct.

### 8.3 Parts taxonomy — DRAFT v1 (`MART_CATEGORIES`)
Shape: `{ id, en, si?, ta?, examples: string, keywords: string[], types: [{ id, en, keywords: string[] }] }`. **Ids below are final; the developer adds keywords (common Sri Lankan names and spellings, e.g. "brake pad", "break pad", "pads") and si/ta labels. Vikum reviews the English list once.** "Other" is always last and has no types.
| id | Label | Examples line | Type ids |
|---|---|---|---|
| `engine` | Engine | Pistons, gaskets, belts, pumps | `engine_assembly, cylinder_head_gasket, pistons_rings, timing_belt_chain, oil_pump_sump, water_pump, fuel_pump, injectors, turbo_intercooler, engine_mounts, exhaust_catalytic, spark_plugs_coils, belts_pulleys` |
| `brakes` | Brakes | Pads, discs, calipers, drums | `brake_pads, brake_discs, brake_calipers, drums_shoes, master_cylinder, abs_sensor_module, handbrake_parts, brake_hoses_lines` |
| `suspension_steering` | Suspension and Steering | Shocks, arms, bushes, racks | `shock_absorbers, springs, control_arms, ball_joints_bushes, stabilizer_links, steering_rack, power_steering_pump, tie_rods, wheel_bearings` |
| `electrical_lighting` | Electrical and Lighting | Batteries, alternators, bulbs, lamps | `battery, alternator, starter_motor, headlights, tail_lights, indicators_fog_lamps, bulbs, wiring_fuses, switches, sensors, ecu_modules, horn, wiper_motor` |
| `body_exterior` | Body and Exterior | Bumpers, mirrors, doors, glass | `bumpers, bonnet, doors, fenders, boot_lid, side_mirrors, glass_windscreen, grille, body_panels, trims_mudguards, spoilers_roof_racks` |
| `interior` | Interior | Seats, dashboards, mats | `seats, dashboard, steering_wheel, door_trims, floor_mats, instrument_cluster, airbags_seat_belts, interior_switches_controls` |
| `transmission_clutch` | Transmission and Clutch | Gearbox, clutch, axles | `gearbox, clutch_kit, flywheel, driveshaft, cv_joints, differential, gear_linkage, cvt_parts` |
| `cooling_ac` | Cooling and AC | Radiators, compressors, fans | `radiator, cooling_fan, thermostat, ac_compressor, ac_condenser, heater_core, cooling_hoses, expansion_tank` |
| `tyres_wheels` | Tyres and Wheels | Tyres, rims, nuts | `tyres, alloy_rims, steel_rims, wheel_nuts, spare_wheels, tpms_sensors` |
| `filters_fluids` | Filters and Fluids | Oil, air and fuel filters | `oil_filter, air_filter, fuel_filter, cabin_filter, engine_oil, gear_oil, brake_fluid, coolant, additives` |
| `accessories` | Accessories | Audio, covers, tools | `audio_speakers, cameras_dashcams, seat_covers, car_covers, tools_jacks, gps_trackers, other_accessories` |
| `other` | Other | Anything else | (none) |
Both the mobile app and the backend validate against this list; the Mart Home chips show these 12 (plus "All"). Search matches the labels and keywords.

---

## 9. Rollout (safe changes to the single production database)

There is only one environment (Render + Neon free) and no migrations. Follow this order **exactly**:
1. **Backup first.** Take a manual `pg_dump` of production (or a Neon branch snapshot if available) and store it in R2 (or any safe place). Confirm the file is not empty. Do not skip this.
2. Build the daily `pg_dump` → R2 job (Step 0, strongly recommended before launch).
3. Add the schema in section 1 and 2 to `schema.prisma`. Run `npx prisma validate` and `npx prisma generate`.
4. Run `npx prisma db push` from the developer machine against production **only after step 1**. Because every change is additive, Prisma must not ask to reset or drop anything. **If Prisma warns about data loss or asks to reset, STOP and do not confirm.**
5. Check after the push: `User` rows unchanged (count before = after); new tables exist and are empty.
6. Deploy the backend (git push → Render). Mart routes exist but are closed by the beta gate (`MART_BETA_PHONES`), so nothing changes for current users.
7. Ship the mobile JS by OTA to the `preview` branch first; test with the beta phones; later publish to production when Vikum says so.
Rules for any future change: new columns must be nullable or have a default; never rename or drop a column that an older app version reads; never change the type of a column.

---

## 10. Account deletion (extend `backend/src/scripts/deleteAccount.ts`, then expose it as in-app "Delete my account")

For the deleted phone `P` (and its `User.id`):
- **Delete (also delete R2 photos under the deleted ads' `photoUrls` and the shop logo, best effort):** `MartFavorite` (userPhone = P), `MartFollow` (either side), `MartBlock` (either side), `MartSearchHistory`, `MartShopProfile`, `MartWantedAlert` (sellerPhone = P, and rows whose `listingId` is one of P's ads), all `MartListing` owned by P (cascade removes their favorites, threads, messages and ratings), all `MartThread` where P is `otherPhone` (cascade removes messages), `MartSellerRating` where `raterPhone = P` or `sellerPhone = P`.
- **Keep:** `MartReport` rows. The reporter/target phone strings are retained deliberately for investigation, and `targetTitle`/`targetSnippet` keep the reported content readable after the ad is deleted. **(proposed)** Remove them after 90 days with a manual admin step later.
- `AppNotification` rows for P are deleted (existing script behavior).
- Other people's chats about P's deleted ads disappear with the ad (hard delete is acceptable here because the account no longer exists).

---

## 11. Quick reference — table summary

| Table | Purpose | Key unique rule |
|---|---|---|
| `MartListing` | selling ads and wanted requests | — |
| `MartFavorite` | heart saves | (userPhone, listingId) |
| `MartThread` | one chat per (ad, other person) | (listingId, otherPhone) |
| `MartMessage` | text / offer / system lines | — |
| `MartSellerRating` | ratings from confirmed deals | (listingId, raterPhone), (raterPhone, sellerPhone) |
| `MartFollow` | following sellers/shops | (followerPhone, sellerPhone) |
| `MartBlock` | block pairs | (blockerPhone, blockedPhone) |
| `MartReport` | trust and safety reports | — |
| `MartShopProfile` | Shop details | ownerPhone |
| `MartWantedAlert` | one alert per request per seller | (listingId, sellerPhone) |
| `MartSearchHistory` | recent searches (Phase 2 For You) | (userPhone, term) |
| `User` (+4 cols) | displayName, district, rules acceptance | — |
| `AppNotification` (+index) | `mart_*` notifications | — |
