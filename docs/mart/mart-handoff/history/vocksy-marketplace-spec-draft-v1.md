# Vocksy — Vehicle Parts Marketplace
### Draft Feature Spec v1 (discussion draft, not final)

**App context:** Vocksy is the single app (the DriveVault name is retired). This marketplace is a **main feature built into the Vocksy app** — not a separate app, not a separate backend. It shares the same accounts, same database, and same vehicle owner / garage account types as the rest of the app.

---

## 0. Decisions — confirmed

1. **Who can sell:** any registered Vocksy user can post a listing. No separate opt-in/activation step.
2. **Payment:** off-platform (cash/bank transfer on pickup) for now. No in-app payment gateway. Revisit later — not in scope for v1.
3. **Delivery:** no in-app delivery logistics, fees, or courier integration for now — that's still out of scope. **Addition:** sellers get a simple **"Can arrange delivery" toggle** on their listing (Selling only, not shown on Wanted posts) — purely informational, shown as a badge on the listing. Delivery itself is still arranged directly between buyer and seller over chat, same as pickup. This is a UI flag, not a delivery system.
4. **Garage → Shop profile:** existing garage accounts can set up a shop-style seller profile using their existing data — **but there's no verification mechanism in place right now (no BR check, no manual review process)**, so this cannot be called or badged as "**Verified**" Shop. See the renamed section below — this is an important correction from the earlier draft, which assumed a verification badge that doesn't actually exist yet.

---

## 1. Navigation Placement

Mart is added as a **third bottom-nav tab**, alongside the existing two:

`My Vehicles | Garage | Mart`

- Appended after the existing tabs, not reordered — preserves existing muscle memory for current users.
- Labeled **"Mart"** on the bottom-nav tab, not "Vocksy Mart" — the app itself is already Vocksy, so the app name is redundant on a nav label (same reason the second tab is just "Garage"). **The screen's own header title is different: it reads "Vocksy Mart"** (matches the branded header style used elsewhere in the app, e.g. the "Vocksy" title on the My Vehicles screen) — so the nav tab stays short while the page itself carries the full brand name.
- Distinct icon from the other two (shopping bag/storefront — car and building icons are already taken).
- **No separate notification badge on the Mart tab.** All marketplace notifications (messages, wanted-ad matches, etc.) route through the single bell icon / notification center (§8), not a second badge source.
- **Confirmed: Mart is a common feature, identical for both account types** (vehicle owner and garage/service-center owner) — no specialization between the two on this tab. Same nav addition applies to both home screens.

---

## 2. Profile Section

As you listed:
- My Ads (now covers both selling listings and Wanted Ads — see §4)
- For You feed (originally "Watchlist" / "Surveillances/My Watch")
- Favorites
- Followings
- Customer Service

**Favorites vs Watchlist (confirmed — two different features, not one):**
- **Favorites** = the list of ads the user saved by tapping the **heart** on a listing (on the card or the detail page). The user can open this list directly, and there is a **shortcut to it** from Mart (exact placement: open question 12). Private to the user.
- **Watchlist, named "For You" in the UI** = a **system-generated, personalized feed**, not a list the user builds. Vocksy keeps track of what the user types in the Mart search bar and which vehicle(s) they have registered in the app (My Vehicles), and keeps listing the most relevant ads for them, matched on search terms and on vehicle make/model/year. Purpose: bring relevant ads to the user's attention without them having to search again.

Consequences: (1) the seller-side "how many people saved my ad" count is a **Favorites count**, not a Watchlist count (§7); (2) sold/reserved notifications go to users who favorited the ad (§8); (3) Watchlist reuses the structured vehicle fields on listings, so matching a user's vehicles is a simple query. **Confirmed: "For You" (Watchlist) is PHASE 2 — not in the launch version.** It (it needs enough listings to feel useful, plus a stored recent-search list); if a user has no vehicle and no searches yet, show the newest ads; the name "Watchlist" usually means "saved items" in classifieds apps, so "For You" may be clearer for this feed (open question 13); a favorited ad that gets sold or deleted stays in the Favorites list, grayed out with a "Sold" / "Removed" label (open question 15).

**Followings** = following a *seller/shop*, not a product. Only really useful once the "Shop" seller tier (§7) exists — a casual one-off seller isn't something you "follow." Consider deferring this to Phase 2, tied to shop profiles.

**Customer Service (confirmed):** not an in-app contact form — just a **WhatsApp/phone link** that opens a chat to your own number. Lowest possible effort, and it's what people in Sri Lanka already expect/prefer over filling out a form.

---

## 3. Product Listing — Standard Format

This is the core of the product and deserves the most rigor. Proposed standard fields:

| Field | Notes |
|---|---|
| Category | Part type (brakes, engine, electrical, body, tyres, etc.) — needs a fixed taxonomy, not free text |
| Condition | Brand new / Used — required, binary |
| Compatible vehicle | Make, model, year (range) — **reuse the existing Sri Lanka vehicle database** already powering the prediction engine (same app, same DB — no reason to duplicate it) |
| Price | LKR, required |
| Images | Cap at 5–8. Enforce at least 1 to publish |
| Location | District/town level is enough — full address isn't needed for a listing |
| Description | Free text |
| Status | Available / Reserved / Sold — matters a lot (see below) |

**Two things missing from your list that I'd flag as important, not optional:**

- **Listing status (Available/Reserved/Sold).** Without this, your marketplace fills up with dead listings — the #1 complaint about ikman.lk-style apps. A seller should be able to mark sold in one tap, and sold listings should stop surfacing in search/filter-match notifications.
- **A report/flag mechanism.** Even at MVP. You're allowing second-hand part sales — stolen parts, counterfeit brand-new parts, and scam listings are a real liability surface for a marketplace operator, not just a nice-to-have. **Confirmed:** report is for trust/safety issues (scam suspicion, counterfeit claims, misleading details, abusive messages, prohibited items) — not quality complaints about the part itself, which stay a private buyer/seller matter. **Revised:** reports are always stored (a reports table, regardless of how they're surfaced), and for now — since there's no admin portal yet — a report also triggers an **email notification to you**. When the admin portal is built later, it just reads the same stored data; no rework needed, only the delivery/notification layer changes.

**Editing a published listing (confirmed):** full edit allowed, anytime — price, photos, description, condition, everything. No "delete and repost to make a change" restriction. Simpler for the seller, and it's the behavior people already expect from classifieds apps.

**Favorite icon** — heart toggle on the card and the detail page; saves the ad to the user's **Favorites** list (see §2).

**Share** — a share icon on the product detail page (header row, alongside favorite and report), using the device's **native share sheet** (iOS share sheet / Android share intent) rather than a custom in-app share UI — lets the user share to WhatsApp, SMS, or anything else already on their phone without Vocksy having to build individual integrations for each. Technical requirement this implies: each listing needs a **public, shareable deep link** (e.g. `vocksy.app/listing/{id}`) that opens the listing — either in the app if installed, or a basic web fallback view if not. Worth scoping that link/fallback-page work in alongside the share button itself, since the button is useless without it.

**Similar listings at the bottom of an ad** — good instinct, and cheap to build if compatible-vehicle + category fields are structured (not free text), since it's just a query on shared attributes. This is exactly why the compatibility fields need to be structured dropdowns, not a text box.

---

## 4. Wanted Ads — Buyer-Initiated Posts

New addition: buyers can also post, not just sellers. A buyer looking for a specific part creates a **"Wanted Ad"** — sellers who have that part contact the buyer, instead of the buyer having to hunt through listings. This mirrors a pattern already familiar in Sri Lankan classifieds.

**Design approach — reuse the listing model, don't build a parallel system:**

- Same underlying listing schema, with a `type` field: `selling` vs `wanted`.
- Shared fields still apply: category, compatible vehicle, location, description.
- Differences for a wanted ad:
  - **Price** becomes optional — a "budget range" instead of a fixed price.
  - **Images** become optional — a buyer may attach a reference photo but doesn't need to.
  - **Status**: `Open` / `Fulfilled` — buyer closes it manually once sorted.
- **Contact direction flips**: on a wanted ad, the *seller* messages the *buyer*. Same product-based thread model from §6 — no new messaging system needed, just the initiating party is reversed.

**Discovery — this is the part that actually makes it useful:**
1. A browsable **Wanted Ads feed/tab**, same as the main selling listings.
2. **Reverse-match notification**: if a seller's existing listing matches a new wanted ad (same category/vehicle), notify that seller. This is the mirror image of the saved-filter feature in §5 (buyer gets notified of new matching listings; seller gets notified of new matching wanted ads) — same matching engine, run in both directions, cheap to add once saved-filter matching already exists.

There's also a softer benefit worth naming: a wanted ad is a demand signal even for sellers who haven't listed anything yet — seeing "someone wants X" can be what prompts a garage to go list a part they hadn't bothered posting.

**Phasing:** add the `type` field to the listing schema from day one (cheap now, expensive to retrofit later as a schema migration). The Wanted Ads feed/tab and reverse-match notifications themselves aren't MVP-critical — they can land alongside the rest of the saved-filter/notification work in Phase 2.

---

## 5. Search & Filtering

- Filter by vehicle (make/model/year), category, price range, condition, location.
- **Saved filters → notification on match → badge count on the saved filter.** This is a good feature and matches classifieds-app norms. Flagging: this only feels valuable once there's enough listing volume that matches actually occur. Early on, an empty saved-filter feature that never fires anything is worse than not having it — see phasing in §9.

---

## 6. Messaging — Product-Based Threads

Your description is clear and it's the right model (matches Facebook Marketplace / ikman.lk):

- Chat threads are scoped to a **(product, buyer, seller)** triplet, not just (buyer, seller). Messaging a different product from the same seller opens a *separate* thread.
- A **chat icon in the Mart Home header** (next to the bell, not a bottom-nav tab) opens the Mart Messages inbox, which lists all threads, each showing the product thumbnail and product title so context is never lost.
- Inside a thread, show a horizontal strip of "this seller's other listings" — solves your point 8 (finding a seller's other products) without merging threads.

**Correction, based on the actual current booking chat:** the existing garage-booking chat is **not** a shared thread-list/inbox system — it's an **inline, expandable chat embedded directly inside each booking card**, with no dedicated messaging icon and no central place managing history across bookings. This is a different shape than assumed in the first draft of this section. Given that, and given the original spec's explicit ask for messaging to be **"a major icon on the screen"** (a real inbox), the decision is:

**Mart gets its own separate Messages inbox — not merged with, or built by extending, the inline booking chat.** Booking chat stays exactly as it is today. Mart's messaging is a new, standalone piece of infrastructure, reachable via a chat icon in the Mart Home header (next to the bell).

**Inbox rules (confirmed):**
- Each thread is **titled by the product name**, not the seller's name — the seller's name appears as a secondary line underneath. This matches how a buyer actually thinks about their conversations ("that brake pads chat," not "that chat with Kasun").
- Tapping a thread opens the chat with the **product pinned at the top**, so the buyer can navigate straight back to the original post — consistent with the pinned product bar already designed in the Chat Thread screen.

**Sold-listing behavior (confirmed):**
- When a seller marks a product **sold**, any open thread(s) for that product show a **"Sold" state**: a banner in the thread ("This item was marked as sold — conversation available for N more days") and the compose bar is **disabled** — the buyer can't send further messages.
- The thread remains visible (read-only) in the inbox for **7 days** after being marked sold, then is **soft-deleted** — hidden from the buyer's active inbox. **Not hard-deleted:** the underlying record is retained (not user-visible) since the report/flag feature in §3 needs something to investigate if a dispute surfaces after the fact — a hard-deleted conversation leaves nothing to check.
- In the inbox list, a sold thread's preview text becomes something like *"Sold • 5 days left to view"* and the row is visually muted (grayed) so active conversations stand out.

**Listing-deleted behavior (new — a gap the sold-only design missed):** if a seller deletes the listing entirely (not just marks it sold), the pinned product reference would break unless handled deliberately. Fix: **the thread's product title and thumbnail are snapshotted into the conversation record at thread-creation time**, not live-joined to the listings table — so the title survives even after the listing is deleted, no generic placeholder needed. What *does* change: the **"View Ad" button disables** (nothing to view), and the thread enters a second terminal state — **"Removed"** — alongside "Sold," with its own banner wording ("This listing was removed by the seller") but the same read-only + 7-day-then-hidden behavior.

Confirmed: Vocksy already has a messaging system for garage-booking communication (owner ↔ booking, embedded inline per booking card as described above) — **Mart does not extend it**; it's built as its own system per the correction above.

**Contact flow, step by step:** buyer taps "Message Seller" on the product detail page →
- If no thread exists yet for this exact (product, buyer, seller) combination, one is **created** and opened, with the product pinned at the top of the thread.
- If a thread already exists for that combination, it's simply **opened** — no duplicate threads for the same listing.
- Messaging a *different* listing from the same seller always opens a **separate** thread, even though it's the same two people — consistent with the scoping decided above.

**Confirmed:** the first message is pre-filled with *"Hi, is this still available?"*, editable/removable before sending — buyer can clear it and type their own if they prefer.

**Delete conversation (confirmed):** either party can delete a whole conversation, reached via a "•••" menu in the thread header, with a confirmation step before it takes effect. Consistent with the soft-delete pattern already established for sold/removed threads: **one-sided delete** — it disappears from the deleter's own Messages, but the other party still sees it on their side, and nothing is hard-deleted from the backend (same dispute-investigation reasoning as §6's retention decision). If both parties delete it, it's gone from both active views but still retained, not user-visible, for report investigation.

---

## 7. Trust Layer — Sellers & Ratings

This is where I'd push back a little on the spec as written, because a few things overlap:

- 1.4 "product reviewer as count"
- 5.2 "seller able to see a count of how many users saved his product"
- 7. "product rating"

These read as three different things wearing similar names. Recommend cleanly separating them:

| Concept | What it is | Visible to |
|---|---|---|
| **Favorites count** | How many users saved (hearted) this listing | Seller only sees the count; never sees *who* |
| **Seller rating** | Rating of the seller, earned only from confirmed sales (see "Rating flow" below) | Public; ALL sellers (casual and Shop) can have one |
| **Product rating** | Dropped as a separate concept — each rating belongs to one confirmed sale and rolls up into the seller rating | — |

**Two seller tiers**, as you described — renamed to be honest about what actually exists right now:

1. **Casual seller** (default) — just posts an ad. Can receive seller ratings from confirmed sales. No shop profile.
2. **Shop seller** — set automatically from behavior, not opt-in and not "Verified": Garage account OR 5+ ads in the last 90 days. Shop details auto-fill from the Garage profile. Same rating system as casual sellers.

### Rating flow (CONFIRMED — mirrors the existing Garage rating)
Garage today: garage submits work → owner taps Accept → rating modal pops up automatically (1–5 stars + optional comment, Skip always available). The garage never requests a rating. Mart copies this exactly:
1. Seller taps **Mark Sold** and picks **who bought it** from the buyers who chatted about that ad (threads already store product + buyer + seller). Or picks **"Sold outside Vocksy"** → no confirmation, no rating, not counted.
2. The chosen buyer gets ONE notification plus a banner in the chat thread: "[Seller] marked this as sold to you. Confirm purchase?" with **Confirm** and **Not me**.
3. On **Confirm**, the rating modal pops up automatically (same modal as garage: 1–5 stars, optional comment, Skip always available). On **Not me**, the sale is not counted: no rating, no "Items sold" credit.
4. The seller has no button to request, remind or chase a rating. They only see the aggregate rating and written reviews.
Rules: a confirmed purchase is required to rate; one rating per sold listing (unique on listing + buyer); seller cannot rate their own sale or change the buyer after confirmation; buyer needs a few chat messages in the thread (anti-fake guard); one rating per buyer–seller pair; rating comment length-capped like other free text; reports reach the owner as usual. Known weak spot (accepted for launch): two colluding accounts can fake a sale.

**Data:** new table `SellerRating` — `id`, `listingId`, `buyerPhone`, `sellerPhone`, `rating` (1–5), `comment?`, `createdAt`; unique on (`listingId`, `buyerPhone`). Do NOT reuse `GarageRating` (it requires a vehicle and a service submission). Reuse the UI and logic pattern: ★ avg (count) badge, star-distribution modal, `getRatingStats`-style helper (avg rounded to 1 decimal + count), a ratings endpoint returning distribution + 30 latest reviews, and the same auth/IDOR rules (`authMiddleware`, rating scoped to the logged-in confirmed buyer, 409 on duplicate).
**API sketch:** `POST /listings/:id/mark-sold` (seller, with buyerPhone or "outside"), `POST /listings/:id/confirm-purchase` (buyer: confirm or decline), `POST /listings/:id/rate` (confirmed buyer), `GET /sellers/:id/ratings`.
**Garage that also sells parts:** show two separate ratings on the profile — "Service" (from `GarageRating`) and "Parts sales" (from `SellerRating`). Never mix them.
**Display:** badge on the seller profile, the product detail page, and My Mart; new sellers show "No reviews yet".


Dropping the word "Verified" is deliberate, not cosmetic. Calling it "Verified" implies you've checked something — BR number, ownership, identity — and right now nothing is actually checked. A false trust signal is worse for the brand than no badge at all, especially since trust/verification is meant to be Vocksy's whole differentiator elsewhere in the app. If you want a real "Verified" badge later, that needs an actual verification step behind it (even something lightweight, like a manual BR-number check by you) before the label is used.

**The data-reuse opportunity still stands, just without the "verified" claim:** since this is one app/one database, a seller who's already a registered **Garage** on Vocksy already has their shop name, address, and phone number on file. Don't make them re-enter it — auto-offer "Set up your Shop profile using your Garage details," one tap, reading fields that already exist. The trust signal here is softer than "verified" but still real: *"this is a registered garage on Vocksy,"* which is more than a self-typed shop name from a casual seller.

---

## 8. Notifications

Consolidate into one system rather than building each notification type separately:
- New message
- Saved-filter match
- Product sold/reserved status change (for users who favorited the ad)
- New rating received (once ratings exist)

A single notification center with type-based icons is much less work than N separate notification features, and it's what your spec is implicitly asking for anyway ("we need to take all notifications for the following features").

---

## 9. Release plan (replaces the old "Suggested Phasing", updated 2026-10-05)

Every screen below is designed. The old plan put Wanted, Ratings, Shop, Followings and the notification center in "Phase 2"; that is no longer true. Build in the order of `05-build-plan.md`, shipped as three milestones, each behind the beta gate (`MART_BETA_PHONES`):

- **Milestone 1 (beta, Vikum's phones):** profile (name + district), post/edit/delete ads, status (available/reserved), photos, browse/search/filters, favorites, product chat + inbox, My Ads, My Mart, similar ads.
- **Milestone 2:** Wanted ads + offers, Mark sold / who bought / confirm / ratings, Shop tag + shop profile + seller public profile + reviews, Followings, Mart notification center + push.
- **Milestone 3 (public launch):** Report, Block, Mart rules + first-post checkbox, account deletion, daily backup job, Customer Service row (when a number exists).

**Still Phase 2 (not built now):** saved filters + match notifications, For You / Watchlist (recent searches are stored from day one), Wanted specialty picker, admin portal, deep links, payments.

## 10. Bigger-picture positioning note

ikman.lk and riyasewana.com already dominate general vehicle-parts classifieds in Sri Lanka. A generic "post parts, browse parts" marketplace competes head-on with two entrenched, well-known players on their own turf. Vocksy's real edge, if you want one, is the same edge the maintenance-tracking side already has: **verified data**. A used part listed with a link back to a Vocksy-verified maintenance record (e.g. "removed from a Vocksy-tracked Axio, 82,000km, verified service history") is a listing no competitor can produce, because they don't have your data. Not a v1 requirement — but worth keeping as the direction once the core loop works, rather than staying a plain classifieds clone long-term.

---

## 11. Development Order

1. Data model: extend vehicle DB fields for listings (include `type`: selling/wanted from the start)
2. Product posting (listing creation with standard fields)
3. Product listing status (Available/Reserved/Sold, or Open/Fulfilled for wanted ads)
4. Image upload for listings
5. Favorites (heart toggle, Favorites list, shortcut from Mart)
6. Browse/search
7. Filters (vehicle, category, price, condition, location)
8. Similar listings on ad page
9. Report/flag button (stores report in `MartReport` + push to the owner's phone via `ADMIN_PHONES`; NO email — email does not exist in the app; no admin screen yet)
10. Mart Messages — standalone inbox (product-titled threads) + sold/7-day handling
11. "Seller's other listings" strip in chat thread
12. My Ads (profile section)
13. Customer Service (WhatsApp/phone link)
14. Wanted Ads feed (Selling | Wanted switch) + posting flow + **offers** (offer sheet, offers list, Mark Fulfilled with seller confirm; see 'Wanted offers')
15. ~~Favorited ad that is sold/deleted~~ **Resolved: stays in Favorites, grayed, with "Sold"/"Removed" label; user can remove it manually.**
16. Reverse-match notifications (Wanted Ads → sellers)
17. Mart notification center (Mart-only list, `mart_*` types, Mart unread count)
18. For You (Watchlist) — personalized feed from the user's searches + registered vehicles (**PHASE 2 — confirmed, not in launch**)
19. Shop seller profile (Garage auto-fill)
20. Seller ratings (confirmed-sale flow, see §7)
21. Followings
22. Admin portal — reads the reports table already being populated since #9 (future work, no timeline yet)

---

**Added 2026-10-05 (from the codebase reality check, all confirmed):** Step 0 prerequisites (shared prefs util, `displayName` + `district` on User, districts constant, shared helpers/components, push dead-token cleanup, `ADMIN_PHONES`, cursor paging) come BEFORE item 1. Also needed and not yet numbered: Block user (`MartBlock`), 'Mart rules' screen with first-post checkbox, in-app Account deletion, `MartReport`, `MartShopProfile`, offers (stored as the first message type 'offer' in `MartMessage` with price/photos/note), `MartSearchHistory` (store recent searches from day one for Phase 2 For You).

---

## 12. UI Design Decisions

> **Build-level detail for every finalized screen (layout, states, actions, data, gaps) is in `vocksy-mart-screen-specs.md`.** Keep both files together when giving them to VS Code.

**Mart — Browse Feed:** Grid Cards direction chosen (2-column, image-forward card grid). See the design canvas: [Mart — Browse Feed](https://claude.ai/artifact/5iNN34aP7g9ycDcg22XfyC) (artboard "A — Grid Cards"). Header, search, category chips, favorite toggle, condition tag, and bottom nav (My Vehicles / Garage / Mart) all follow this layout going forward for the main feed screen.

Mart Home details in the chosen design: header reads "Vocksy Mart" with a **chat icon** (opens Mart Messages, unread dot) and the **bell**; full-width search bar with a filter button beside it (opens the Filters screen); horizontally scrolling **category chips**; 2-column card grid where each card shows image, heart toggle, condition tag (New/Used), title, price in LKR (amber) and location; a floating **"+" button** for posting an ad. The other two explored directions (List Rows, and Selling/Wanted tabs) were **not chosen**. Where the Wanted Ads feed lives is still open (question 9).

Product Detail contents in the chosen design: image carousel with status pill (Available/Reserved/Sold), condition tag, price, title, location + posted date, delivery badge (if enabled), vehicle chips (make/model/year), description, seller row (name + active ad count), "Similar Parts" strip, and a sticky "Message Seller" button.

**Product Posting:** Single Scroll Form direction chosen over the 4-step wizard — lower build effort for v1, still covers Selling/Wanted toggle (Price→Budget Range, photos optional, Condition hidden for Wanted), photos, category, vehicle compatibility, title, description, price/budget, location. See the design canvas: [Vocksy Mart — Product Posting](https://claude.ai/artifact/5c7wpEwKiFH55qFDZM1jHP) (artboard "A — Single Scroll Form").

**Product Detail:** Standard Scroll direction chosen over the hero-overlay/bottom-sheet direction — matches the flat white-header pattern already used on the feed and posting screens, less build effort, and keeps the report icon directly visible rather than tucked in an overflow menu. Header row: back, **share** (native device share sheet — requires a public shareable deep link per listing, e.g. `vocksy.app/listing/{id}`), favorite, report. Also shows a **"Delivery available" badge** near the location line when the seller has enabled it. See the design canvas: [Vocksy Mart — Product Detail](https://claude.ai/artifact/DQyWsmrGv72GD9DNLGzztJ) (artboard "A — Standard Scroll").

**Filters:** Full Screen direction chosen over the bottom-sheet direction — consistent with the full-screen pattern already used for posting, less layout work than a dimmed-backdrop sheet. Includes a **"Save this search" toggle, shown disabled with a "coming soon" label** (Phase 2 feature per §5 — UI slot reserved now, not functional in v1). See the design canvas: [Vocksy Mart — Filters](https://claude.ai/artifact/A2qTowGSAAfdcKCYFerUiv) (artboard "A — Full Screen").

**Product Posting (addition):** a **"Can arrange delivery" toggle** added to the Selling flow only (not shown for Wanted posts) — informational, no logistics/fees, delivery still coordinated off-platform via chat. Canvas updated: [Vocksy Mart — Product Posting](https://claude.ai/artifact/5c7wpEwKiFH55qFDZM1jHP).

**Messaging:** own standalone Mart inbox (not merged with booking chat — see corrected §6), reached via a chat icon in the Mart Home header. Threads titled by product name, seller name secondary. Sold listings show a read-only banner and disabled compose bar, stay visible for 7 days, then drop out of the inbox. See the design canvas: [Vocksy Mart — Chat Thread](https://claude.ai/artifact/DD8i9uqE7uKnanpbMDAh91) (artboard "Mart Messages (final)" + "Chat Thread" — the earlier "Segmented Tabs" artboard is superseded, kept only for reference).

---

### My Ads (designed — Direction A, Status Tabs)
- Opens from the person icon (My Mart profile) → My Ads.
- Top: **Selling | Wanted** switch. Under it, status tabs with counts: Selling = Available / Reserved / Sold; Wanted = Open / Fulfilled.
- Each ad is a row card: thumbnail, title, price (budget range for Wanted), favorites count, chat count (replies for Wanted), age, and a "⋯" menu (Edit, Share, Delete).
- Two buttons per card, changing by status: Available → Mark Reserved / Mark Sold; Reserved → Mark Available / Mark Sold; Sold → Relist / Delete; Wanted Open → Edit / Mark Fulfilled; Fulfilled → Repost / Delete.
- Sold/Fulfilled cards are slightly faded. A floating "+" button posts a new ad.
- Directions B (summary tiles + grid) and C (grouped sections) were not chosen.

### Mart Home header (updated)
Title "Vocksy Mart", then 4 icons: Favorites (heart), Messages (chat, unread dot), Notifications (bell), My Mart profile (person). Card location text must not wrap (ellipsis).


### NOTE — For You is Phase 2
For You (personalized feed from search terms + registered vehicles) is confirmed as **Phase 2**. Do NOT build it in Phase 1 and do not add a tab for it on Mart Home yet. Phase 1 should still be ready for it: store each user's recent Mart searches from day one so the data exists when For You is built.


### NOTE — Mark Sold now has a buyer step
Tapping Mark Sold (My Ads) opens a "Who bought it?" picker (buyers from this ad's chats, plus "Sold outside Vocksy"). See §7 Rating flow. The My Ads and Mart Messages designs need a matching picker sheet and a buyer-side "Confirm purchase" banner.


### My Mart profile (designed — Direction A, Menu List)
- Header: avatar, name, seller tag (Casual / Shop), district, rating badge "★ 4.8 (12) · Parts sales" (tap opens the distribution modal; same component as the garage rating) or "No reviews yet" for a new seller, and an Edit button.
- MY ACTIVITY group: My Ads, Favorites, Followings, Reviews (each with a short count line; Reviews says "Reviews appear after your first confirmed sale" when empty). HELP group: Customer Service (WhatsApp/phone).
- Directions B (dashboard tiles) and C (seller card first) were not chosen.

### Sale confirmation and rating screens (designed)
1. **Who bought it? (seller)** — bottom sheet after tapping Mark Sold: list of buyers from this ad's chats (name, message count, last chat), single-select, plus "Sold outside Vocksy"; buttons Mark as Sold / Cancel.
2. **Confirm purchase (buyer)** — amber banner at the top of the chat thread: "[Seller] marked this as sold to you" with Not me / Confirm purchase. Thread shows the Sold tag and a "Marked as sold" system line; chat stays visible 7 days.
3. **Rate the seller (buyer)** — modal right after Confirm: 1–5 stars (tappable), optional comment, Submit, Skip always available (same pattern as the garage rating modal).

---

## Open questions to resolve before this goes to VS Code

1. ~~Does marketplace access need an explicit opt-in?~~ **Resolved: any Vocksy user can sell, no opt-in.**
2. ~~Payment handling for v1?~~ **Resolved: off-platform, no gateway for now — future possibility, not in scope.**
3. ~~Pickup vs. delivery?~~ **Resolved: no in-app delivery logistics — pickup or seller-arranged delivery, coordinated off-platform via chat. Sellers get an informational "Can arrange delivery" toggle on Selling listings (see §0).**
4. ~~Auto-link Garage accounts to a shop tier?~~ **Resolved: yes, but without a "Verified" badge/claim — no verification mechanism exists yet.**
5. ~~Existing messaging system to extend, or net-new?~~ **Corrected after seeing the actual booking chat UI: it's inline/embedded per booking, not a shared inbox. Mart builds its own separate, standalone Messages system rather than extending it — see §6 for the corrected decision.**
6. ~~Sold-thread retention at 7 days: hard-delete or archive?~~ **Resolved: soft-delete — hidden from the buyer's inbox, but retained (not user-visible) for dispute/report investigation. See §6 for the full decision, including the related "listing deleted by seller" edge case and the title-snapshotting fix.**

**Still open (found when reviewing the doc — none block the next screen, but all should be settled before building):**

7. ~~Watchlist vs Favorites~~ **Resolved: two separate features — Favorites (heart-saved list with a shortcut) and Watchlist (personalized feed from search terms + the user's vehicles). See §2.**
8. ~~Category and district lists~~ **Resolved: do NOT limit categories to a short fixed list — support as many parts categories as possible (expandable taxonomy) plus an "Other" option. Districts: all 25 Sri Lanka districts.**
9. ~~Wanted Ads feed location + seller type~~ **Resolved: Selling | Wanted switch on Mart Home. Seller type is NOT asked ("regular vs one-time" is unreliable). Instead: (a) "Shop" tag set automatically from behavior — Garage account OR 5+ ads in the last 90 days; everyone else is a casual seller. (b) Wanted requests notify sellers matched by past ads: same category, ideally same make, nearest district first. (c) Limits: 1 notification per Wanted Ad per seller, max ~20 sellers per request, sellers can turn "Wanted request alerts" off. Phase 1: Garage auto-Shop tag + category/make matching. Phase 2: optional specialty picker (categories/makes) in Shop profile + alert settings.**
10. ~~Reserved status in chat~~ **Resolved: amber "Reserved" tag under the product title in chat; chat stays open for other buyers.**
11. ~~Sold state on detail page~~ **Resolved: ad stays visible 7 days with a "Sold" banner, grayed photo, no message button; then removed.**
12. ~~Favorites shortcut placement~~ **Resolved: heart icon in the Mart Home header.**
13. ~~For You name and phase~~ **Resolved: named "For You"; Phase 2 (not in launch). Phase 1 Mart Home has no For You tab.**
14. ~~Mart profile entry point~~ **Resolved: person icon in the Mart Home header.**
15. ~~Favorited ad that is sold/deleted~~ **Resolved: stays in Favorites, grayed, with "Sold"/"Removed" label; user can remove it manually.**

Questions 1–6 above are resolved. See §9 for the recommended MVP scope and §7 for the Shop-tier naming correction.

---

## Quick Reference — Screens Designed So Far

| Screen | Direction Chosen | Canvas |
|---|---|---|
| Mart Home / Browse Feed | Grid Cards | [link](https://claude.ai/artifact/5iNN34aP7g9ycDcg22XfyC) |
| Product Posting | Single Scroll Form | [link](https://claude.ai/artifact/5c7wpEwKiFH55qFDZM1jHP) |
| Product Detail | Standard Scroll | [link](https://claude.ai/artifact/DQyWsmrGv72GD9DNLGzztJ) |
| Filters | Full Screen | [link](https://claude.ai/artifact/A2qTowGSAAfdcKCYFerUiv) |
| Mart Messages (Inbox + Chat Thread) | Standalone, product-titled | [link](https://claude.ai/artifact/DD8i9uqE7uKnanpbMDAh91) |
| My Ads | A — Status Tabs | [link](https://claude.ai/artifact/9X3fAC7kp5h5a9znauP7hK) |
| My Mart profile | A — Menu List | [link](https://claude.ai/artifact/2LGBiGR9BZxURmWRS1LF33) |
| Sale confirmation + rating flow (Who bought it? sheet, buyer Confirm banner, rating modal) | One design per step | [link](https://claude.ai/artifact/LMcEDvpgNR2DFQUygeS5Ys) |
| Wanted Ads feed | A — Switch + Request Cards | [link](https://claude.ai/artifact/DLatAa7KuHsXKvDxriuLL9) |
| Notification center | A — Grouped by Day (Mart-only list) | [link](https://claude.ai/artifact/1aWP3NTWyjAoAnpmWZ4Eub) |
| Wanted offers: offer sheet + offers list | A Bottom Sheet + A Cards | [link](https://claude.ai/artifact/6dLHfJLFdZX2n65SigjLwV) |
| Shop profile setup | A — Single Form | [link](https://claude.ai/artifact/89tXKvcLhBjmc1B24ehFN7) |
| Favorites list | A — List + Filters (chips: All / Available / Sold-Removed; sold/removed grayed with label; heart removes) | [link](https://claude.ai/artifact/2NdJPqrnAKUpCqoyoFv7UB) |

All screens are designed (For You is Phase 2). **For You** is Phase 2 (design later). Customer Service is just a WhatsApp/phone link (number pending), no screen. The Admin portal is future work, no screen yet.


---

## Codebase reality check (from the tech reference, 2026-10-04) — READ BEFORE BUILDING

Source: vocksy-mart-tech-reference.md (Express 5 + TypeScript + Prisma 6 + Postgres; Expo 54 / React Native 0.81; no navigation library; deployed on Render; `prisma db push`, no migrations folder, no tests).

### Conventions Mart MUST follow
- **People are identified by `phoneNumber`, not `User.id`.** All Mart ownership fields use phone: `sellerPhone`, `buyerPhone`, `reporterPhone`, `followerPhone`, etc., with `references: [phoneNumber]` where a relation is declared. Scope every query with `req.phoneNumber!` (IDOR pattern).
- IDs are `cuid()`. Statuses are plain `String` with a default literal (no Prisma enums): listing `type` = selling|wanted; selling status = available|reserved|sold; wanted status = open|fulfilled.
- Errors are `{ error: "<message>" }`. Validation is manual if-checks (no zod). Use `capText(value, SHORT_TEXT_LEN | LONG_TEXT_LEN)` on all free text. Rate-limit spam-prone writes with `checkRateLimit(scope, key, max, windowMs)`.
- Images: reuse `POST /uploads/photo` (Cloudflare R2, 5MB, magic-byte check, 60/hour). Listings need up to 8 photos, so use a separate rate-limit scope for Mart uploads and a `mart-photos/` key prefix. No server compression exists (client `quality: 0.7` only).
- Notifications: reuse the `AppNotification` table (`type`, `title`, `body`, `linkTo`) plus Expo push (`User.pushToken`) and the existing NotificationsScreen.
- Messaging: the existing convention is REST on demand — NO websockets, NO polling; messages load when a thread opens or the screen gains focus. Mart chat does the same. The unread dot on the Messages icon needs an `unread-count` endpoint (like notifications). Mart needs NEW models (`MartThread`, `MartMessage`); `BookingNote` is per booking and is not reused.
- Mobile: no navigation library. Each new screen means a new entry in the `Screen` union in `App.tsx`, a JSX block, and an entry in the Android `backMap`. The bottom tab bar (`BottomTabBar.tsx`) has only My Vehicles and Garage today; Mart is the third tab.
- Reuse components: `ScreenHeader`, `Button`, `Chip`, `FormField`, `AppIcon` (MCI icons). Theme is `mobile/src/theme/colors.ts` (primary #1d3a5f, accent #e3a008), which matches the designs. For small amber TEXT on white (prices) the mockups use a darker amber (#b97f00) for contrast.
- i18n: `mobile/src/i18n/` has en, si AND ta (Tamil). All Mart strings go through translation keys from day one.
- Name Mart screens with a `Mart` prefix (the existing `SellScreen` is for the vehicle-sale transfer, a different feature).
- The vehicle make/model list is a client-side constant (`mobile/src/constants/vehicleData.ts`, `BRAND_MODELS`); no endpoint serves it. Listings store make/model as strings plus year from/to; the server cannot validate against the list unless it is copied to the backend.
- No pagination convention exists. Mart feeds need one (suggest `take` + cursor on `createdAt,id`).
- No soft-delete exists anywhere. The Mart rules (7-day sold/removed chats, retained for reports) need a new `hiddenAt`/`deletedAt` convention on Mart tables.

### Gaps this reveals (decisions pending — NOT yet decided)
1. **Email does not exist** in the codebase. The spec's "reports are emailed to you" has no sender. Options: (a) reports table + push notification to the owner's own phone (no new service), (b) add an email provider.
2. **User has no name and no district.** The designs show seller name and district. Mart needs new fields (e.g. `displayName`, `district` on User, or a Mart-only profile table). Profile photo already exists (`profilePhotoUrl`).
3. **Deep links do not exist** (no URL scheme, no associated domains, no live domain). The Share feature's public link `vocksy.app/listing/{id}` needs a domain, app link config and a web fallback page. Decide: full deep link, or a simpler share (text + listing summary) first.
4. **`Garage.verified` and `brNumber` already exist** (verified badge, BR optional). Spec uses a "Shop" tag and avoids "Verified". Confirm they stay separate.
5. **Reports vs the app's "no dispute" philosophy** (CLAUDE.md: no reject/dispute button). Reports are for scams, counterfeit and prohibited items, not transaction disputes. Confirm this is consistent.
6. Launch blockers outside Mart: OTP is only logged to console (no SMS provider), and schema changes go out with `prisma db push` (no migrations).


---

## Codebase reality check, Part 2 (UI, notifications, roles, platform) — 2026-10-04

Source: vocksy-mart-tech-reference.md Part 2. Facts first, then what they mean for Mart.

### UI facts Mart screens must match
- **Header:** `ScreenHeader` props = `title`, `subtitle?`, `onBack`, `rightElement?`. Mart Home's 4 header icons go in `rightElement`.
- **Sheets/modals:** plain RN `Modal` styled as a bottom sheet (no library). "Who bought it?" and rating modal use this same pattern.
- **Feedback:** `Alert.alert` only. No toast/snackbar exists. Mart uses `Alert.alert`, unless we decide to build one small shared toast (optional).
- **Empty/loading/error:** no shared component; each screen does it inline (ActivityIndicator + icon + text). Mart should add ONE shared `MartEmptyState` for its many lists.
- **Pull-to-refresh:** FlatList `onRefresh`/`refreshing`. Use on all Mart lists.
- **Cards:** thin border + soft shadow, radius 10–16, padding 12–20. The mockups already match.
- **Chip:** `Chip` props = `label`, `selected`, `onPress` (no icon, no count). Filter chips with counts need a small extension.
- **Button:** variants `primary | secondary | destructive`, no size prop.
- **No "+" floating action button exists** (FloatingHomeButton is a different thing). "Post an ad" is a normal button or tab action in the app's style.
- **Photos:** `expo-image-picker` supports `allowsMultipleSelection` + `selectionLimit` (used in AddServiceRecordScreen). Good for the 5–8 photo listing form. No shared fullscreen photo viewer exists (3 screens each have their own). Mart needs a shared `MartPhotoViewer`.
- **Search:** only a plain TextInput in MyVehiclesScreen. Filter chips in VehicleHistoryScreen are hand-rolled. Mart builds its own search + filter UI.
- **Formatting:** NO shared `formatCurrency` and NO shared relative-time helper (`timeAgo` is private inside NotificationsScreen). Mart needs shared `formatLKR()` and `timeAgo()` in `mobile/src/utils/`, i18n-aware.
- **Rating badge/modal:** duplicated inline in GarageScreen and BookingScreen, not reusable. Build ONE shared `RatingBadge` + `ReviewsModal` for garage AND seller ratings (Reviews list / distribution modal is one of the screens still to design).

### Notifications facts
- `createNotification(prisma, userPhone, type, title, body, linkTo?: object)` — linkTo is JSON-stringified. `sendPush(pushToken, title, body, data?)` — one token per call, no batching, Expo response never read (invalid tokens never cleaned).
- Existing types are all booking/vehicle related. Mart adds: `mart_message`, `mart_wanted_match`, `mart_sale_confirm`, `mart_sale_confirmed`, `mart_rating`, `mart_report_received` (owner only).
- **Tap routing lives in `App.tsx` (~line 725–751)**, not in NotificationsScreen. Every Mart `linkTo` (`{ screen: 'martThread', threadId }`, `{ screen: 'martListing', listingId }`, `{ screen: 'martWanted', listingId }`) needs a new branch there. Unknown targets fall back to the vehicle list, so a missing branch fails silently.
- **Prefs bug:** `PUT /auth/notification-prefs` only saves 7 keys and silently drops `garage_reminder`; `parsePrefs()` is copied in 6 backend files. Fix: extract one shared `utils/notificationPrefs.ts` with all keys, then add `mart_message`, `mart_wanted` (the "Wanted request alerts" switch) and `mart_rating`. This is a prerequisite task, not optional.
- **Wanted-request fan-out (max ~20 sellers) = 20 separate push calls.** Acceptable at launch size. Do the push in the background after responding to the poster, never inside the request.
- **Jobs use `setInterval`** started in `index.ts` (no cron, no worker). On Render free the server sleeps and timers reset. The 7-day cleanup of sold/removed chats and ads must therefore be **idempotent and based on timestamps** (e.g. "hide where soldAt < now - 7 days"), run on startup and hourly. It must never depend on a timer firing at an exact moment. Also: reads should filter by `hiddenAt`/dates so UI is correct even if the job did not run.

### Roles and profile facts
- `hasGarage` comes from `api.getGarage(token)` success/404 (App.tsx ~274). Dual role can be added any time (Profile > Register Garage). Garage is edited inline in GarageScreen (no separate edit screen).
- Garage fields a Shop profile can reuse: name, village/town, aboutBio, contactPhone, photos (max 5), websiteUrl, googleMapsUrl, services, promoText.
- **No Sri Lanka district/town list exists.** Mart needs a constant of all 25 districts (`mobile/src/constants/districts.ts`, with en/si/ta names) and the backend must validate against the same list.

### Platform facts
- **No offline queue exists** (CLAUDE.md is wrong on this). A Mart write offline just fails with the "Could not connect" alert. Same as everywhere. Mart must NOT promise offline posting. Photo upload failures mid-post need a clear retry (see below).
- **No API versioning, no minimum-app-version check.** Old installs keep calling new backend forever. All Mart backend changes must be additive. Mart tab should appear only in the new app build (it will, since it is new UI). Consider adding a `/app-config` min-version check before launch (optional, small).
- **OTA via expo-updates, runtimeVersion policy = appVersion.** JS-only Mart changes can ship OTA; adding a new native permission/package needs a new build.
- **app.json:** no `scheme`. Android permissions: CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE. Location not used (so "district" is picked by hand, no GPS).
- **Linking:** 3 inline calls in BookingScreen. No WhatsApp helper, no `wa.me` anywhere, no support contact exists. Mart needs a shared `openPhone()` / `openWhatsApp()` helper and Vikum must supply the customer-service number.
- **expo-sharing is installed** (used for PDF export). RN `Share` is not used. Native share sheet with plain text works without new packages.
- **Hosting:** Render free + Neon free (7-day backup window, no off-platform backup, no backup script). Mart adds user-generated data and photos, so the daily `pg_dump` to R2 becomes a real need.
- **Legal/moderation gaps (all new for Mart):** no in-app Terms/Privacy screen (privacy policy is a web page only), no prohibited-items list, no in-app account deletion (CLI script only), no block-user, no admin role/tooling, no analytics or crash reporting.

### Decisions (ALL 10 CONFIRMED by Vikum, 2026-10-04 — recommendations accepted as written)
| # | Decision | Confirmed answer |
|---|----------|----------------|
| 1 | Reports without email | `MartReport` table + push to Vikum's own phone. Add a simple env var `ADMIN_PHONES` (comma list) and a read-only `GET /admin/reports` guarded by it. No email at launch. |
| 2 | Name and district | Add `displayName` and `district` to `User` (nullable). Ask at the first Mart action (post / message), not at app signup. Reuse for the whole app later. |
| 3 | Share link | Launch with native share of plain text ("Brake Pads — Rs. 3,500 — Colombo 5, on Vocksy Mart") + app store link. Real deep links later when a domain exists. |
| 4 | Shop tag vs Garage.verified | Keep separate. "Shop" = behavior-based Mart tag. `Garage.verified` stays the BR badge for garages. |
| 5 | Reports vs "no dispute" | Consistent. Reports are for scams, fakes and prohibited items. Payment and price disagreements stay between the two people. Write this sentence in the in-app report screen. |
| 6 | Block user (new) | Phase 1: simple "Block" in chat menu (hides that person's ads + chats for you). Small table `MartBlock` (blockerPhone, blockedPhone). Marketplace apps need this. |
| 7 | Prohibited items + Terms (new) | Phase 1: a short in-app "Mart rules" screen shown once before the first post, with a checkbox. Content = list of banned items. Vikum to approve the list. |
| 8 | Account deletion (new) | Required by app stores for apps with accounts. Add in-app "Delete account" calling the logic in `scripts/deleteAccount.ts`, extended to cover Mart data. Not Mart-only, but Mart raises the urgency. |
| 9 | Push hardening (new) | Small fix: read Expo's response and clear `pushToken` on `DeviceNotRegistered`. Do before Mart launch. |
| 10 | Post-ad photo upload failure | Upload photos one by one with per-photo retry; the ad is only created after all photos upload; keep the form state on failure. |

### Prerequisite tasks before Mart screens (add to Dev Order as "Step 0")
1. Shared notification prefs util (fix 7-key bug).
2. `displayName` + `district` on User; districts constant.
3. Shared helpers: `formatLKR`, `timeAgo`, `openPhone`, `openWhatsApp`.
4. Shared `RatingBadge` + `ReviewsModal`, `MartPhotoViewer`, `MartEmptyState`.
5. Push response handling (clear dead tokens).
6. `ADMIN_PHONES` env var + admin guard.
7. Cursor-pagination convention for Mart feeds (`take` + cursor).


**Customer Service contact: PENDING.** Vikum has no WhatsApp/phone number yet and will add it later. Build the Customer Service row with a config constant `MART_SUPPORT_WHATSAPP` (empty for now); hide the row when it is empty.


### Favorites list (Direction A, CHOSEN 2026-10-04)
One card per row (80px photo, title, LKR price, district, condition). Filter chips: All | Available | Sold / Removed. Reserved shows an amber tag. Sold/Removed rows are grayed with a label; the heart removes the item. Header shows the saved count. Empty state uses the shared `MartEmptyState`.

**Next session:** design Followings, Reviews list / rating modal, Seller public profile, Wanted ad detail variant, pickers, then write the developer handoff docs.


### Wanted Ads feed (Direction A, CHOSEN 2026-10-05)
Mart Home gets a **Selling | Wanted** segmented switch under the search bar (Selling default). Wanted mode shows request cards (14px padding): title, vehicle chip + category chip, 'Budget' label + budget in amber (range or 'Up to Rs. X'), line 'Name · District · age · N replies', full-width button **I have this** (opens a chat on that request with a prefilled message). A request that matches the viewer's past ads shows an amber 'Matches you' tag. The viewer's own request shows an outlined 'Your request' button instead. Category chips and search stay and apply to requests. The '+' button posts in the current mode. Not chosen: B (tabs + compact rows), C (post banner + matches section).


### Notification center (Direction A, CHOSEN 2026-10-05)
The Mart bell opens a **Mart-only** list (not the existing all-types NotificationsScreen). Needs a small endpoint returning only `mart_*` types and a Mart unread count for the bell dot. List is grouped TODAY / EARLIER. Row = 38px round type icon (message, request, sale, star), title (bold when unread), body (max 2 lines), relative time, amber dot + soft amber background when unread. Header: back, title 'Notifications', 'Mark all read'. Tap a row -> mark read + route by `linkTo` (new branches in `App.tsx`). Types: `mart_message`, `mart_wanted_match`, `mart_sale_confirm`, `mart_sale_confirmed`, `mart_rating`. Not chosen: B (filter chips), C (action-needed section).

### Wanted flow after "I have this" (CONFIRMED by Vikum 2026-10-05)
- No auction, no bidding, no "highest bid". Payment and final price stay off-platform (same as selling).
- **I have this** opens a small sheet (not straight into chat): **Your price** (Rs., optional), **Photo of the part** (optional, up to 3), **Note** (optional, max 300 chars). Button **Send offer**. It creates (or reopens) the thread for (request, seller, buyer) and the first message is an **offer card**: photo, 'Offer: Rs. 28,000', note.
- The request owner gets a push + Mart notification 'New offer on your request'. The request's reply count goes up. My Ads > Wanted shows replies as a list of offers (seller name, Shop tag, rating, price). Tapping an offer opens the chat. Price talk continues in chat.
- A seller can send only one offer per request (editing = send a chat message). Owner can reply or ignore. Max offers shown/limit: no limit at launch.
- **Mark Fulfilled** (owner): opens 'Who sold it?' with the sellers who offered (+ 'Got it outside Vocksy'). Chosen seller gets one notification: 'Confirm you sold this' (Confirm / Not me). On Confirm, the request owner is asked to rate the seller (same rating modal, same rules). Order differs from selling because here the SELLER confirms the sale and the BUYER rates.
- Confirmed. Screens to design: offer sheet, offers list (in My Ads > Wanted).


### Wanted offers (CHOSEN 2026-10-05: offer sheet A, offers list A)
- **Offer sheet A (bottom sheet):** grabber, title 'Send an offer', request summary box (title, district, owner name, budget), 'Your price (optional)' with 'Rs.' prefix, 'Photos of the part (optional, up to 3)' strip with Add tile, 'Note (optional)' 2-line textarea, navy 'Send offer', text 'Cancel'.
- **Offers list A (cards):** screen 'Offers' reached from My Ads > Wanted (tap a request card or its 'N offers'). Top: request title, budget, navy 'Mark Fulfilled' button. List heading '3 OFFERS'. Offer card: 72px photo, seller name, age, Shop tag + rating (or 'No reviews yet'), price (amber), note, outlined 'Open chat' button. Order: newest first. Not chosen: offer sheet B/C, offers list B/C.


### Shop profile setup (Direction A, CHOSEN 2026-10-05)
Single scrolling form 'Shop details', only for users with the automatic **Shop** tag (casual sellers do not see it; they see a hint in My Mart: 'Register a Garage or post 5 ads in 90 days to become a Shop'). Top: blue info box 'Filled from your Garage. Changes here only affect your Mart shop. Your Garage details stay as they are.' Fields: Shop logo (72px square, 'Change logo'), Shop name, About your shop (3-line textarea), Phone / WhatsApp, District (picker), Town / address, Website (optional), Google Maps link (optional). Bottom of form: 'Wanted request alerts' toggle shown DISABLED with 'coming soon' (Phase 2). Sticky navy 'Save'. Data: stored in a Mart-only table `MartShopProfile` (ownerPhone unique, name, logoUrl, about, contactPhone, district, townAddress, websiteUrl, googleMapsUrl); first open pre-fills from `Garage` (name, aboutBio, contactPhone, village/town, websiteUrl, googleMapsUrl, photos[0]); casual-turned-Shop without a Garage starts empty with name = displayName. Not chosen: B (preview first), C (essentials only).


## Seller public profile and Reviews list (CONFIRMED 2026-10-05)
Design board: https://claude.ai/artifact/HEsfePCa3A1XoCMUvN1Kbg
- Seller public profile: A Header + Tabs for Shop sellers, B Single Scroll for Casual sellers (same screen, layout switches on tag). C Shop Cover is a later upgrade.
- Reviews list: A Bottom Sheet, one shared `ReviewsModal` (Service / Parts sales tabs for garages that sell parts). B full screen and C compact popup not chosen.
- Full build detail in vocksy-mart-screen-specs.md sections 16 and 17.


## Followings and Wanted ad detail (CONFIRMED 2026-10-05)
Design board: https://claude.ai/artifact/4EoELwGVKqmPmofeaXydTk
- Followings: A Simple List (new table `MartFollow`; "N new ads" badges are Phase 2). B tabs and C new-ads cards not chosen.
- Wanted ad detail: A Budget Card with optional reference photo strip (B) and a separate Owner view (offers banner, Edit, Mark fulfilled). Visitors tap "I have this".
- Full build detail in vocksy-mart-screen-specs.md sections 18 and 19.


## Report, Block and Mart rules (CONFIRMED 2026-10-05)
Design board: https://claude.ai/artifact/YZpkfWJzMDGWL6v8Vv5nnM
- Report: A Reason List Sheet (reasons scam, fake, prohibited, spam, abuse, other; dispute-free wording) then "Report sent" with optional "Also block". Saved in `MartReport`, push to `ADMIN_PHONES`.
- Block: B Consequences Sheet; `MartBlock` enforced on the server (lists, direct open, messaging); follows removed; chats hidden but kept and return on unblock. Blocked users list under My Mart.
- Mart rules: A Full Screen, 7 rules, checkbox + Continue before first post; also readable from My Mart. `User.martRulesAcceptedAt` + version. Rule wording is a draft for Vikum to review.
- Full build detail in vocksy-mart-screen-specs.md section 20.


## Pickers (CONFIRMED 2026-10-05)
Design board: https://claude.ai/artifact/QyaTCUdhrucy6Z3B4EZjju
- Category: A Expandable List (12 categories, types inline, search). Vehicle: A Searchable Steps (Make, Model, Year from/to). District: A Searchable List (25 districts, user's district pinned).
- Full build detail in vocksy-mart-screen-specs.md section 21. The final parts taxonomy constant `MART_CATEGORIES` still has to be written (developer drafts, Vikum reviews).
- All screens of Mart are now designed. Next: export designs, write the developer package, run the fresh-start check.


## Codebase reality check — Part 3 (2026-10-05) and decisions 11–20 (CONFIRMED by Vikum 2026-10-05: "ok" to all as recommended)
Facts from Part 3 of the tech reference: Make/model/year are free strings on the server (BRAND_MODELS exists only in mobile); garage rating is computed live per request; no API versioning or min-version; push responses never read; ONE environment only (no staging); app is on the Play internal testing track (v1.0.3, versionCode 16); updates ship by OTA (`runtimeVersion` = appVersion) and EAS builds; Neon free has a 7-day backup window and no off-platform backup; no Mart name clash; the app has dark mode.

| # | Finding | Decision (confirmed) |
|---|---|---|
| 11 | Matching "Matches you" uses free strings | Add a backend `normalizeVehicleText()` (lowercase, trim, collapse spaces, drop text after " / ") and match on normalized make AND model (year inside the ad's year range). Copy `BRAND_MODELS` into `backend/src/data/vehicleCatalog.ts` (note: duplicate of the mobile file for now) and validate Mart ad make/model against it, allowing "Other" with free text. |
| 12 | Ratings computed live | Keep it live for Phase 1. For lists (Home grid, Followings) fetch ratings for the whole page with ONE `groupBy` query, never one query per card. No cached column yet. |
| 13 | No min-version, no API versions | All Mart routes live under `/mart/...`. All database changes are additive (new tables, new nullable User columns). Never rename or remove anything that old apps use. Add `GET /app-config` returning `{ minVersion: null, martEnabled }` in Step 0 so future apps can force an update. |
| 14 | Mart is JS-only, so it ships by OTA to everyone on 1.0.3 | Gate Mart behind a beta switch: env var `MART_BETA_PHONES` (comma list; empty list = everyone) returned by `GET /app-config` as `martEnabled` for the logged-in user. The Mart tab is hidden when false. This protects testers and the single production service. Turn it on for everyone at launch by emptying the variable. |
| 15 | One environment, no staging, no backup | Before the first Mart `prisma db push`: (a) take a manual `pg_dump` (or a Neon branch snapshot if the free tier allows) and save it to R2; (b) build the planned daily `pg_dump` to R2 job in Step 0, because Mart adds user content; (c) preferably create a staging Neon branch + a second Render service + a `preview` EAS profile pointing at it. (a) is required, (b) strongly recommended, (c) optional. |
| 16 | Phone numbers must never leak | Public API ids use `User.id` (called `sellerId`), never the phone. Fixed in screen specs sections 16, 18, 20. Internal tables still key by phone to match the codebase. |
| 17 | Photos: no server resize, key prefix `service-photos/` | Mart uploads use a new prefix `mart-photos/<hash>/<uuid>.<ext>` through the same `/uploads/photo` route with a whitelisted `folder` field (default stays `service-photos`). Mobile resizes to max 1280px wide and quality 0.7 before upload (confirm `expo-image-manipulator` is installed; the existing code already compresses before upload). |
| 18 | Dark mode exists | Mart screens use theme tokens, not hex values (screen specs section 0.1b). |
| 19 | Palette | Code values (`#1d3a5f`, `#e3a008`) are the source of truth, matching the Project instructions. The older `#012362 / #F5A623` note is NOT used. |
| 20 | Play Store status unclear | Not a Mart blocker. Ask Vikum to check Play Console. Mart ships by OTA only if no native module is added (none planned). |
