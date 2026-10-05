# Vocksy Mart — 04 Screens (build-level screen specs)

Part of the developer package (`00-README.md` has the reading order). This file describes **each finalized screen**: layout top to bottom, every element, states, actions, data. PNG pictures of every chosen screen are in `designs/chosen/` (index in `designs/README.md`).

**Precedence:** (1) `02-data-model.md` for fields, statuses and limits, (2) `03-api.md` for endpoint paths and response shapes, (3) this file for layout and behavior, (4) the pictures. Where a screen section below names an endpoint or field slightly differently, `02` and `03` win. Where a picture and this text differ, this text wins (section 11 lists the known differences). Do not stop to ask; follow this order.

Status: 2026-10-05. All screens are final (sections 1 to 21). Only "For You" is Phase 2.

Constants referenced here: `MART_CATEGORIES` (taxonomy in `02-data-model.md` §8.3), `DISTRICTS` (§8.2), `MART_RULES` (section 20.4 below), `BRAND_MODELS` (existing, `mobile/src/constants/vehicleData.ts`).

---
## 0. Global design rules

### 0.1 Colors (same as `mobile/src/theme/colors.ts`)
| Use | Value |
|---|---|
| Primary (navy): headers text, primary buttons, selected chips, my chat bubbles | `#1d3a5f` |
| Accent (amber): hearts, price on big text, unread dot, active-tab underline | `#e3a008` |
| Price on small text (better contrast on white) | `#b97f00` |
| Screen background | `#f5f6f7` |
| Surface (cards, headers) | `#ffffff` |
| Card border | `#ececec` |
| Input border | `#e2e4e7` |
| Text main / secondary / faint | `#1a1a1a` / `#6b7078` (or `#4a4f57`) / `#8a8f98`, placeholder `#a3a8b0` |
| Success (Available pill, Delivery) | text `#1e7a34`, border `#cdeeda` |
| Amber soft banner (Reserved, Sold notice, Confirm purchase) | bg `#fdf1d8`, text `#5c3f00` / `#92600a` |
| Gray tag (Used, Sold, Removed) | bg `#eef0f2` or `#e5e8eb`, text `#4a4f57` / `#5b6169` |
| New tag | bg `#fdf1d8`, text `#92600a` |
| Destructive | `#c0392b` |
| Messages unread dot (header icon) | `#e3453a` with white 1.5px ring |
| Placeholder image colors in mockups (`#7f8b99` etc.) | stand in for real photos; not a design choice |

Note: the hearts in the Mart Home and Detail mockups are **amber** (`#e3a008`), filled when saved, outline when not. Use the same on Favorites. Existing `colors.ts` has `accent #e3a008`, so use theme tokens, not hard-coded hex.

### 0.1b Use theme tokens and support dark mode (added after Part 3 of the tech reference)
The app already has `lightColors` and `darkColors` (`mobile/src/theme/colors.ts`) and a `useColors()` hook (`ThemeContext`). The mockups are light only, so the developer must NOT copy the hex values above into styles. Map them to tokens so dark mode works:
| Mockup use | Token |
|---|---|
| navy `#1d3a5f` | `colors.primary` |
| amber `#e3a008` | `colors.accent` |
| screen bg `#f5f6f7` | `colors.background` |
| cards/headers `#ffffff` | `colors.surface` |
| card border `#ececec` | `colors.border` |
| input border `#e2e4e7` | `colors.borderMid` |
| main text `#1a1a1a` | `colors.text` |
| secondary text `#6b7078` / `#4a4f57` | `colors.textSub` |
| faint text `#8a8f98`, placeholder `#a3a8b0` | `colors.textMuted` / `colors.textFaint` |
| gray tag bg `#eef0f2` | `colors.primaryTint` (text `colors.primaryTintText`) or `colors.surfaceAlt` |
| amber soft banner bg `#fdf1d8` | `colors.accentTint` (text `colors.accentTintText`) |
| success green | `colors.success` |
| destructive red `#c0392b` and unread dot `#e3453a` | `colors.error` |
Rule: if a tint has no token, add it to BOTH `lightColors` and `darkColors` in Step 0; never leave a hard-coded light color in a Mart screen. The existing code card style (radius 12–14, 1px border + soft shadow, padding 14–16) is the card style for Mart; the mockups' border-only cards map to it.

### 0.2 Layout and type
- Screen padding 16px. Card radius 12, thumbnail radius 8–9, chips fully round (999), input radius 9, big buttons radius 10.
- Cards: 1px `#ececec` border (the app also uses a soft shadow; either is fine, match `NotificationsScreen`).
- Font: system font. Screen title 20–22px bold navy. Card title 13–13.5px semibold. Price 15px bold. Meta 11–12.5px.
- Header pattern: `ScreenHeader` (`title`, `subtitle?`, `onBack`, `rightElement?`) for every screen except Mart Home (own title row) and Filters (close X, Reset on the right).
- Bottom bar: `My Vehicles | Garage | Mart`. Visible on Mart Home, My Mart, My Ads, Favorites, Messages inbox. **Hidden** on full-screen flows: Posting, Detail, Filters, Chat thread.
- Garage tab only shows for users with a garage (existing `hasGarage` logic).

### 0.3 Shared components to build (Step 0, see main spec)
`MartListingCard` (grid card), `MartListingRow` (list row), `MartEmptyState`, `MartPhotoViewer`, `RatingBadge`, `ReviewsModal`, `MartBottomSheet` (RN `Modal`, slide), `formatLKR()`, `timeAgo()`, `openPhone()`, `openWhatsApp()`.

### 0.4 Common states (apply to every list screen)
- **Loading:** centered `ActivityIndicator` (navy), as in NotificationsScreen.
- **Empty:** icon + one line + (where useful) one button. Texts are given per screen.
- **Error:** inline message + "Try again" button. Never a blank screen. Offline = existing "Could not connect" alert; no queue.
- **Pull to refresh:** FlatList `onRefresh/refreshing` on every list.
- **Paging:** cursor (`take` 20 + cursor on `createdAt,id`); load more at list end.
- All user-visible text goes through i18n keys (en, si, ta).

### 0.5 Status labels used across screens
| Listing state | Where | Look |
|---|---|---|
| Available | Detail image pill | white pill, green text, green border |
| Reserved | Detail pill, Chat product bar, Favorites | amber soft tag "Reserved" |
| Sold | everywhere | gray tag "Sold", photo grayed |
| Removed | Favorites, Chat | gray tag "Removed" / "LISTING REMOVED", photo grayed/dimmed |

---

## 1. Mart Home (Browse Feed) — Direction "Grid Cards"
**Purpose:** main Mart screen. Browse, search, filter, jump to Favorites / Messages / Notifications / My Mart, post an ad.
**Entry:** Mart tab. **Exit:** Detail (tap card), Filters, Post Ad, header icons.

**Layout (top to bottom)**
1. **Header row (white, border-bottom):** title "Vocksy Mart" (20px bold navy, no wrap) on the left. Right, 4 icon buttons (22px, navy, 6px padding, 2px gap), in this order:
   1. Favorites (heart outline) → Favorites list.
   2. Messages (chat bubble) → Mart inbox. Red dot (8px, `#e3453a`) when any unread Mart message.
   3. Notifications (bell) → Notification center (section 13). Show dot when unread Mart notifications exist.
   4. My Mart (person) → My Mart profile.
2. **Search + filter row (white):** search field (gray `#f0f1f2` rounded 10px, search icon, placeholder "Search parts, brand, model…") + square 40x40 navy filter button (sliders icon) → Filters screen.
3. **Selling | Wanted switch** (decision: lives on Mart Home; **the original mockup lacks it; see section 12 (Wanted feed) for the final layout**). Selling is the default.
4. **Category chips:** horizontal scroll. "All" selected by default (navy fill, white text); others white with `#dfe2e5` border. Chip list is the parts taxonomy (mockup shows All, Engine, Brakes, Body, Electrical, Tyres; real list is longer and ends with "Other").
5. **Feed:** 2-column grid, 12px gap. **Card:** image 108px high; heart button top-right (28px round, white 92% bg; amber filled when saved); condition tag bottom-left (New = amber soft, Used = gray); below: title (2 lines, ellipsis), price "Rs. 3,500" (15px bold amber), district with pin icon (single line, **ellipsis, never wraps**).
6. **Post button:** floating "+" 52px navy circle, bottom-right, 84px above bottom (above the tab bar).
7. **Bottom bar** with Mart active (navy, bold).

**Behavior**
- Tap card → Detail. Tap heart → toggle favorite (optimistic, revert on error). No navigation.
- Typing in search: run on submit (keyboard "search"), not on each key. Save each submitted term to the user's recent Mart searches (needed for Phase 2 "For You"; store from day one, keep last ~30, private).
- Category chip + Filters + search combine (AND). Filters button shows a small count badge when filters are active (add; not in mockup).
- Feed order: newest first. Sold and Removed ads never appear in the feed. Reserved ads do appear (with a Reserved tag on the card; add).
- Empty result: "No ads match your search" + "Clear filters" button.
- Hide ads from users the viewer has blocked.

**Data per card:** `id, title, price, condition, district, firstPhotoUrl, status, isFavorited`.

---

## 2. Product Posting — "Single Scroll Form"
**Purpose:** create a Selling or Wanted ad. One long form, one sticky submit button.
**Entry:** "+" on Mart Home / My Ads; also used for Edit (same form, prefilled, title "Edit Ad"). **Exit:** back (confirm discard if the form has changes) or success → the new ad's Detail.

**Layout**
- Header: back + title. Title = "Post Ad" (Selling) / "Post Wanted Ad" (Wanted). Edit = "Edit Ad". Type switch is **disabled in edit mode**.
- Fields in this order (labels 12.5px semibold; 18px gap):
  1. **What are you posting?** segmented control: Selling | Wanted (selected = white pill with soft shadow).
  2. **Photos (up to 8)** — for Wanted the label adds "— optional". Horizontal strip of 76px tiles with a small X to remove; last tile is a dashed "+ Add" tile. Multi-select from gallery or camera (`expo-image-picker`, `allowsMultipleSelection`, `selectionLimit` = remaining). First photo = cover. Selling needs **at least 1 photo**; Wanted 0.
  3. **Category** — dropdown row "Select category" → category picker (section 21.1; list from the expandable taxonomy, "Other" last). Required.
  4. **Condition** (Selling only) — two buttons New | Used. Required for Selling. Hidden for Wanted.
  5. **Compatible Vehicle** — Make (full width), then Model and Year side by side. Make/Model use the bundled `BRAND_MODELS`. Mockup shows a single Year; the data model and filters use **year from / to**, so the form should offer a year range (decision to confirm at build: "Year from" + "Year to" pickers). Make required; Model/Year optional ("fits all" allowed). Pickers: section 21.2.
  6. **Title** — text input, placeholder "e.g. Brake Pads (Front) — Toyota Axio". Required. Max 100 chars (suggest; `capText`).
  7. **Description** — 4-line textarea, placeholder "Describe the part's condition, fitment notes, etc." Optional; max 3000 chars (`LONG_TEXT_LEN`).
  8. **Price** (Selling) / **Budget Range** (Wanted) — "Rs." prefix + number input. Placeholder "0.00" / "e.g. 15,000 – 20,000". Selling: single positive number (required). Wanted: min–max, or "up to X" (max required, min optional). Stored as numbers, shown with `formatLKR`.
  9. **Location** — dropdown "Select district" → district picker (25 districts; section 21.3). Required. Default = user's profile district.
  10. **Can arrange delivery** (Selling only) — toggle (42x24, navy when on). Helper: "You'll coordinate delivery directly with the buyer". Informational only.
- Sticky bottom bar: full-width navy "Post Ad" / "Post Wanted Ad" button (edit: "Save Changes").

**Behavior and rules (from decisions)**
- Before the **first ever post**: if the user has no `displayName` or `district`, ask for them (small sheet), then show the **Mart rules** screen with a required checkbox. Both are one-time.
- Submit validates all required fields; show errors under the field (red text) and scroll to the first error. Disable the button while uploading.
- **Upload flow:** upload photos one by one (`POST /uploads/photo` with Mart prefix), per-photo progress + per-photo "Retry" on failure; the ad record is created only after **all** photos are uploaded; the form state is kept on any failure. 5MB limit per photo; client quality 0.7.
- Rate limit posting (suggest 10 ads/hour/user).
- Wanted ads: after create, trigger the matching-seller notifications in the background (see main spec §4/§8).
- Edit: any field can be changed any time. Editing a Sold ad is not allowed (Relist first).

**Data (create):** `type, title, description?, categoryId, condition?, make?, model?, yearFrom?, yearTo?, price? | budgetMin?/budgetMax?, district, deliveryAvailable, photoUrls[]`.

---

## 3. Product Detail — "Standard Scroll"
**Purpose:** full view of one ad; start a chat.
**Entry:** Mart Home card, Favorites, My Ads, Similar Parts, chat "View Ad", seller strip. **Exit:** Message Seller → chat; seller row → Seller profile; back.

**Layout**
1. **Header (white, border-bottom):** back (left). Right, 3 icons (20px, 14px gap): **Share**, **Favorite** (heart, amber, filled when saved), **Report** (flag, gray `#8a8f98`; always visible, not in a menu).
2. **Image carousel:** 230px high, full width, swipe; dots at the bottom (active white, others 50%). **Status pill** top-left: Available (green), Reserved (amber), Sold (gray). Tap an image → `MartPhotoViewer` (fullscreen, swipe, pinch).
3. **Info block (16px padding):**
   - Condition tag (New/Used).
   - Price "Rs. 3,500" (22px bold amber). Wanted: "Budget Rs. 25,000 – 35,000".
   - Title (16px bold).
   - Location line: pin icon + "Colombo 5 • Posted 3 days ago" (12.5px gray). Use `timeAgo`.
   - "Delivery available" (green truck icon + text) — only if the seller enabled it.
   - Vehicle chips: Make, Model, Year range (pills, `#dfe2e5` border).
4. Divider. **Description** (13px bold heading, 13.5px body, line-height 1.55).
5. Divider. **Seller row:** avatar (44px circle, navy, initials), name "Kasun P.", sub "Colombo 5 • 6 active ads", chevron → Seller public profile (section 16). **Add (decided after this mockup):** seller tag "Shop" when applicable, and the rating badge "★ 4.8 (12)" or "No reviews yet".
6. Divider. **Similar Parts:** horizontal strip of 128px cards (image 92px, 2-line title, amber price). Same category + make first; max ~10; excludes this ad, sold, removed.
7. **Sticky bottom bar:** full-width navy button "Message Seller" with chat icon.

**States**
- **Sold:** gray "Sold" banner/pill, photos grayed, **no Message button** (replace by a disabled gray bar "This item was sold"). Page stays reachable 7 days after sold, then the ad is gone (opening an old link/favorite shows "This ad is no longer available").
- **Reserved:** amber "Reserved" pill; Message button still works.
- **Own ad:** viewer is the seller → replace "Message Seller" with "Edit" and "Mark Sold" (reuse My Ads actions); hide Report; hide Favorite.
- **Removed/deleted:** "This ad is no longer available" empty state with back button.
- **Wanted ad variant — NOT DESIGNED.** Needs: "Budget" label, "Wanted" tag instead of condition, optional photos, and the bottom button changed to "I have this" (opens chat with a prefilled message). Design before build.

**Behavior**
- **Share:** native share sheet, plain text "Brake Pads (Front) — Toyota Axio • Rs. 3,500 • Colombo 5 — on Vocksy Mart" plus app store link (decision 3). Real deep link later.
- **Favorite:** toggle, optimistic.
- **Report:** opens the report sheet (reasons: Scam, Counterfeit / fake part, Misleading ad, Abusive behavior, Prohibited item; optional note up to 300 chars). Saved to `MartReport`; push to Vikum. Show the sentence: "Price or payment disagreements stay between you and the other person."
- **Message Seller:** open the thread for (this ad, this buyer); create it if none, with the **editable pre-filled first message** "Hi, is this still available?".

---

## 4. Filters — "Full Screen"
**Purpose:** refine Mart Home results.
**Entry:** filter button on Mart Home. **Exit:** "Show N Results" (apply) or X (discard).

**Layout**
- Header: X (close, left), title "Filters" (center), "Reset" (amber text, right).
- Sections (22px gap, labels 12.5px semibold):
  1. **Category** — wrap of round chips (All, Engine, Brakes, Body, Electrical, Tyres… full taxonomy + Other). Single select (All = no category filter). Consider multi-select later.
  2. **Compatible Vehicle** — Make (full), Model (full), Year from | Year to (side by side). Model enabled only after Make.
  3. **Condition** — three buttons: Any (default) | New | Used.
  4. **Price Range (Rs.)** — Min and Max numeric inputs with an em dash between.
  5. **Location** — "Select district" dropdown (single district at launch).
  6. **Save this search** — toggle **shown disabled** with "Get notified of new matches — coming soon" (Phase 2; no function in v1).
- Sticky bottom: navy button "Show 24 Results". The number is a live count from the server for the current choices (call a count endpoint, debounced; if it fails show "Show Results").

**Behavior**
- Reset clears every filter (also categories) but stays on the screen.
- X closes without applying. Applying returns to Mart Home and shows active-filter count on the filter button.
- Filters apply to the current Selling | Wanted mode; fields not relevant to Wanted (condition) are ignored there.
- Validation: min <= max, year from <= year to.

---

## 5. Mart Messages — Inbox ("Product-Titled")
**Purpose:** all Mart conversations, separate from booking chat.
**Entry:** Messages icon on Mart Home; notification tap. **Exit:** thread.

**Layout**
- Header: "Messages" (22px bold navy) + subtitle "Vocksy Mart conversations".
- List rows (white, divider `#f0f1f2`, 14px padding): 44px product thumbnail (rounded 8), then:
  - Line 1: **product title** (13.5px bold, 1 line ellipsis) + relative time on the right ("2m", "1h", "Yesterday", "4 days ago").
  - Line 2: other person's name (11.5px gray) — "Nadeesha S.", "AutoParts Lanka".
  - Line 3: last message preview (13px, 1 line). **Unread:** preview bold dark + amber dot (8px) at the right. Read: gray, normal.
- **Sold/Removed rows:** whole row at 70% opacity, gray title, gray thumbnail, a gray "SOLD" tag before the preview, preview text "Sold • 5 days left to view" (use "Listing removed • N days left" for removed).
- Order: most recent message first.
- Shown only the viewer's threads; a thread is per (ad, buyer, seller).
- Empty state: chat icon + "No messages yet. Message a seller from any ad." + button "Browse Mart".

**Behavior**
- Tap row → Thread. Pull to refresh. Messages load on open/focus (no sockets, no polling). The header unread dot comes from an `unread-count` endpoint called when Mart Home gains focus.
- Sold/Removed threads disappear from the inbox 7 days after the event (hidden, not hard-deleted).
- **Superseded design:** "Segmented Tabs, mixed with booking" is NOT used. Ignore that board.

---

## 6. Chat Thread (Active / Sold / Removed)
**Purpose:** one conversation about one ad.
**Entry:** inbox row, Message Seller, notification. **Exit:** back, View Ad.

**Layout**
1. Header: back, avatar (36px navy circle with initials), other person's name (15px bold), "⋯" menu.
   - Menu items: **Delete Conversation** (red, trash icon) and **Report**. **Add Block user** (decision 6) between them.
   - Delete confirm dialog (centered, 300px wide): "Delete this conversation?" / "It'll be removed from your Messages. {Name} will still see it on their side." Buttons Cancel | Delete (red). **One-sided delete.**
2. **Pinned product bar:** 44px thumbnail, title (1 line), price (amber) — or "SOLD" / "LISTING REMOVED" (gray bold) instead of price — and a "View Ad" outlined button (disabled-looking and inactive when Removed). Title and thumbnail are **snapshots** saved when the thread was created, so they survive deletion of the ad.
   - **Reserved:** amber "Reserved" tag under the title (decision), chat stays open.
3. **Notice banner** (only when Sold/Removed): Sold = amber soft banner with info icon "This item was marked as sold. This conversation is available for N more days."; Removed = gray banner "This listing was removed by the seller. This conversation is available for N more days."
4. **Confirm purchase banner** (buyer only, when the seller picked this buyer): amber banner "{Seller} marked this as sold to you" with "Did you buy these brake pads? Confirming lets you leave a review." and buttons **Not me** (outlined) | **Confirm purchase** (navy). See §9.
5. **"MORE FROM {SELLER}" strip:** horizontal 80x60 thumbnails with amber prices (the seller's other available ads). Tap → Detail. Hide when the seller has none.
6. **Messages:** other person left, light gray bubble `#eceef0`, radius 14/14/14/4; mine right, navy bubble white text, radius 14/14/4/14; max width 75%; time under each bubble (10.5px, "10:05 AM"). Day separators and system lines (e.g. "Marked as sold", centered gray pill) between bubbles.
7. **Compose bar:** active = rounded input (`#f0f1f2`) with the pre-filled editable text on a new thread + 40px navy round send button. Sold/Removed = the bar is replaced by a gray notice "Messaging closed — this item has been sold" / "...this listing was removed".

**Behavior**
- Send: `POST` message; disable button while sending; show failed state with retry. Max 1000 chars per message (suggest); rate limit ~60/hour like booking notes.
- Opening a thread marks it read. New messages arrive on open/refresh; also via push (`mart_message`) → tapping opens the thread (needs `App.tsx` branch).
- Blocked user: composer disabled with "You blocked this user".
- Mockup note: the "Preview: Active / Sold / Removed" strip at the top of the mockup is a design aid, **not part of the app**.

---

## 7. My Ads — "Status Tabs"
**Purpose:** manage my own listings.
**Entry:** My Mart > My Ads. **Exit:** Detail, Edit (Posting form), Post Ad.

**Layout**
- Header: back + "My Ads".
- **Selling | Wanted** segmented switch (full width, gray track, white selected pill).
- **Status tabs with counts:** Selling = Available | Reserved | Sold. Wanted = Open | Fulfilled. Selected tab: navy bold text, amber 3px underline, amber-dark count.
- **Row cards** (white, 12px radius): 72px thumbnail; title (13.5px semibold); price (Wanted: "Budget Rs. 25,000 – 35,000" / "Budget up to Rs. 20,000"); small stats line: heart count, chat count ("2 chats"; Wanted: "3 replies"), age ("Posted 3 days ago", "Reserved 1 day ago", "Sold 2 days ago"); a "⋯" menu (Edit, Share, Delete).
- **Two buttons per card, by status:**
  | Tab | Left (outlined) | Right (navy) |
  |---|---|---|
  | Available | Mark Reserved | Mark Sold |
  | Reserved | Mark Available | Mark Sold |
  | Sold | Relist | Delete |
  | Wanted > Open | Edit | Mark Fulfilled |
  | Wanted > Fulfilled | Repost | Delete |
- Sold/Fulfilled cards are faded (75%).
- Floating "+" button (post new ad), bottom bar visible.
- Empty states per tab, e.g. Available: "You have no ads yet" + "Post your first ad".

**Behavior**
- **Mark Sold** opens the "Who bought it?" sheet (§9). Mark Reserved/Available: confirm-free, immediate; reserved shows the amber tag in chats.
- **Delete:** confirm dialog; the ad becomes "Removed" for people who have it in Favorites/chat (grayed, 7 days in chats). Sold ads cannot be edited.
- **Relist:** creates the ad as Available again (keeps photos/text; resets age). Old buyer thread stays closed.
- Wanted "replies" = chats started on that wanted ad.
- Tab counts come from the server (one call returns counts + the active tab's list).

---

## 8. My Mart (profile hub) — "Menu List"
**Purpose:** seller identity and shortcuts.
**Entry:** person icon on Mart Home. **Exit:** My Ads, Favorites, Followings, Reviews, Customer Service, Edit.

**Layout**
- Header: back + "My Mart".
- **Identity card (white):** 64px navy avatar (initial or profile photo), name (17px bold), tag "Casual seller" or "Shop" (gray pill), district with pin, then the rating line: `★ 4.8 (12) · Parts sales` (tap → Reviews / distribution modal) **or** "No reviews yet". "Edit" outlined button on the right (edit name, district, photo; Shop details when Shop).
- **MY ACTIVITY** group (rounded white card, 36px icon tile, label 14.5px semibold, sub-line 12px gray, chevron):
  - My Ads — "3 available · 1 reserved · 2 sold"
  - Favorites — "8 saved ads"
  - Followings — "4 sellers and shops"
  - Reviews — "12 reviews from buyers" or "Reviews appear after your first confirmed sale"
- **HELP** group: Customer Service — "Chat with us on WhatsApp or call". **Hidden while `MART_SUPPORT_WHATSAPP` is empty** (number not available yet).
- Bottom bar visible.

**Rules**
- Tag is automatic: **Shop** = has a Garage account OR 5+ ads in the last 90 days; else Casual. Not editable.
- Garage owners who sell parts see **two** ratings: "Service" (garage ratings) and "Parts sales" (seller ratings). Mockup shows only "Parts sales".
- Name and district come from `User.displayName/district`; photo from `profilePhotoUrl`.

---

## 9. Sale confirmation and rating flow
Three connected screens. Rules in main spec §7.

### 9.1 "Who bought it?" (seller bottom sheet)
Opens from **Mark Sold** (My Ads, or Detail for own ad). RN `Modal` bottom sheet over a dimmed (50% `rgba(20,28,40)`) screen; 20px top radius; grabber bar.
- Title "Who bought it?"; help text: "Choose the buyer. They will be asked to confirm the purchase. Only a confirmed buyer can leave a review."
- Single-select list (radio look, selected = navy border + light-blue bg `#eef2f7`): each buyer row = 40px initial avatar, name, "5 messages · last chat 2 days ago". Source: people with a thread on this ad. Plus a last option **"Sold outside Vocksy"** — "Nobody here will be asked to confirm or review".
- Buttons: navy "Mark as Sold" (disabled until a choice is made), text "Cancel".
- Result: ad status = Sold; with a buyer → buyer gets one notification (`mart_sale_confirm`) and a banner in the chat; "outside" → no notification, no rating possible.
- Default selection in the mockup (first buyer) is a demo; in the app nothing is selected at first.
- If the ad has no chats: only "Sold outside Vocksy" is shown (and is preselected).

### 9.2 "Confirm purchase" (buyer, banner in the chat)
See Chat Thread item 4. Chat shows the Sold tag in the product bar, a "Marked as sold" system line, and "This chat stays visible for 7 days." in the footer. **Not me** → buyer declines; the sale stays Sold but with no confirmed buyer, no rating possible, seller is not told who declined. **Confirm purchase** → opens 9.3.

### 9.3 "Rate the seller" (buyer modal)
Centered modal (radius 18) on a dimmed chat. Title "Purchase confirmed" (18px bold navy), "How was your experience with {Seller}?". Five tappable stars (38px, amber outline, filled up to the choice; default in the mockup is 4 but in the app **none selected**, Submit disabled until a star is picked). Optional comment textarea (3 rows, "Add a comment (optional)", cap with `capText`). Buttons: navy "Submit", text "Skip" (always available). Identical pattern to the garage rating modal.
- Skip = purchase is confirmed but unrated; the buyer can rate later from the chat (add a small "Rate seller" link in the chat while the thread is visible).
- Rules: one rating per sold listing; seller cannot rate or request ratings; buyer needs a few chat messages with the seller; one rating per buyer–seller pair.

---

## 10. Favorites list — Direction A "List + Filters" (finalized today)
**Purpose:** everything the user saved with the heart. Private.
**Entry:** heart icon on Mart Home; My Mart > Favorites. **Exit:** Detail.

**Layout**
- Header: back + "Favorites", count text on the right ("5 saved").
- **Filter chips:** All (default) | Available | Sold / Removed. Selected = navy fill/white text; others white with gray border. "Available" includes Reserved.
- **Rows** (white card, 12px radius, 80px thumbnail): title (2 lines), amber heart button at the top-right (tap = remove from favorites), price (15px bold `#b97f00`), meta line "Colombo 5 · Used", plus a tag when needed: Reserved (amber soft), Sold (gray), Removed (gray).
- **Sold / Removed rows:** thumbnail grayscale, text at 60% opacity, gray tag; row stays until the user removes it. Tapping a Sold ad opens its Detail (Sold banner, valid 7 days); after that, or if Removed, show "This ad is no longer available".
- Empty (nothing saved): heart icon + "No favorites yet. Tap the heart on any ad to save it." + "Browse Mart". Empty filter result: "Nothing here".

**Behavior**
- Remove: tap the heart and the row disappears at once. No confirm, no undo. The user can save the ad again from its Detail page.
- Order: most recently saved first.
- Pull to refresh; paging by cursor.
- Not chosen: B (2-column grid), C (grouped sections with "Clear all").

---

## 11. Known gaps and mockup-vs-spec differences (read before building)
All screens are now designed (sections 1 to 21). Remaining differences between the pictures and the written spec (the written spec wins):
1. **Seller rating/tag on the Detail seller row**: added after the mockup; show the tag and the rating badge.
2. **Year**: the posting mockup shows a single "Year"; the data model uses year from/to (section 21.2).
3. **Reserved tag** on feed cards and Favorites: decided, not on the Mart Home mockup. **Filter active-count badge** and the **Selling | Wanted switch on Mart Home**: decided, not in the mockup.
4. Mockup-only aids to ignore: chat "Preview" toggle strip, placeholder colored squares, demo selections (default rating 4, first buyer selected, "Used" hearts filled).
5. Hearts are amber in Mart screens. Do not use red.
6. Customer Service row is hidden until `MART_SUPPORT_WHATSAPP` has a value.
7. Blocked users list footer in the picture says chats stay hidden; the decided rule is that **chats return after unblock, follows do not**.
8. Chat "..." menu: Delete conversation, Report, Block (the mockup shows only the first two).
9. Posting boards are cut at one screen height; the form continues with Price/Budget, Location (district) and the delivery toggle (Selling only).

## 12. Wanted Ads feed — Direction A "Switch + Request Cards" (finalized 2026-10-05)
**Purpose:** let sellers see what buyers are looking for, and let buyers see their requests answered.
**Entry:** Mart Home, Wanted side of the switch. **Exit:** I have this -> chat; card tap -> Wanted ad detail (variant not designed yet).

**Layout:** same header, search and bottom bar as Mart Home. Under the search row: **Selling | Wanted** segmented switch (gray track, white selected pill). Search placeholder in Wanted mode: "Search wanted requests…". Category chips unchanged. Then a single-column list of request cards (white, radius 12, 14px padding, 10px gap). Floating "+" posts a Wanted ad when in Wanted mode.
**Card:** title (14px bold, 2 lines) with optional amber tag "Matches you" at the right; chips: vehicle ("Toyota Axio 2016") and category; label "Budget" (12px gray); budget (16px bold `#b97f00`, "Rs. 25,000 – 35,000" or "Up to Rs. 20,000"); meta "Name · District · 1 day ago · 3 replies" (11.5px gray); full-width button.
**Button:** other people's requests = navy "I have this" -> opens a chat for (this request, this seller) with an editable prefilled message ("Hi, I have a part for this request."). Own request = outlined "Your request" -> opens My Ads > Wanted.
**Rules:** "Matches you" = category (and make, when known) of the viewer's past ads. Fulfilled and removed requests never show. Order: newest first; matches are NOT pinned to the top (keep simple). Replies = chats on that request. Empty: "No requests yet" + "Post a request" button. Blocked users' requests are hidden.
**Not chosen:** B (tabs + compact rows), C (post banner + matches section; the banner idea can return later as an empty-state).


---

## 13. Notification center — Direction A "Grouped by Day" (finalized 2026-10-05)
**Purpose:** Mart-only activity list. **Entry:** bell icon on Mart Home. **Exit:** the item's target screen.
**Layout:** ScreenHeader "Notifications" with "Mark all read" (navy 13px bold) on the right. List grouped under small gray caps headings TODAY and EARLIER (12px bold, `#8a8f98`). Row card: white (unread: `#fffaf0` with `#f3dfae` border), radius 12, 12px padding, 38px round icon (`#eef2f7`, navy icon), title 13.5px (bold 700 when unread, 600 when read, max 2 lines), body 12.5px gray (max 2 lines), time 11px gray at top-right, amber 8px dot at far right when unread. Bottom bar visible.
**Types and targets:**
| type | icon | title / body | taps to |
|---|---|---|---|
| `mart_sale_confirm` | check | "{Seller} marked {Item} as sold to you" / "Tap to confirm your purchase and leave a review." | chat thread (Confirm banner) |
| `mart_wanted_match` | search | "New request near you" / "{title} · {budget} · {district}" | Wanted detail |
| `mart_message` | chat | "{Name}" / last message text | chat thread |
| `mart_rating` | star | "{Name} left you a {n}-star review" / comment | Reviews |
| `mart_sale_confirmed` | check | "{Buyer} confirmed the purchase" | My Ads > Sold |
**Behavior:** tap = mark read and navigate (`linkTo` branches in `App.tsx`: `martThread`, `martListing`, `martWanted`, `martReviews`, `martMyAds`). Mark all read = one call. Empty state: bell icon + "No notifications yet". Pull to refresh; cursor paging. Messages: one row per thread, text updated, not one row per message (avoid flooding). Notification prefs: `mart_message`, `mart_wanted`, `mart_rating` keys (see Step 0 prefs util).
**Not chosen:** B (filter chips), C (action needed section).


---

## 14. Wanted offers — offer sheet A + offers list A (finalized 2026-10-05)

### 14.1 Offer sheet (seller, bottom sheet)
**Entry:** "I have this" on a request card or Wanted detail. RN `Modal` sheet over 50% dim, 20px top radius, grabber.
**Content:** title "Send an offer" (18px bold navy); request summary box (gray `#f5f6f7`, radius 10): title, "District · Owner name" on the left, "Budget" + range (amber `#b97f00`) on the right; **Your price (optional)** — number input with "Rs." prefix, placeholder "e.g. 28,000"; **Photos of the part (optional, up to 3)** — 64px tiles with X, dashed "Add" tile (camera icon); **Note (optional)** — 2-line textarea, placeholder "Condition, fitment, delivery…", max 300 chars; navy **Send offer** button; text **Cancel**.
**Rules:** one offer per seller per request (a second tap opens the existing chat instead). A seller cannot offer on their own request. All fields optional (an empty offer is allowed, it just opens the chat). Photos upload with the Mart photo flow (one by one, retry). On send: create the thread for (request, seller, owner) if none; first message = offer card (photo(s), "Offer: Rs. X", note); push `mart_message` to the owner "New offer on your request"; reply count +1. Rate limit: 30 offers/hour/user.
**States:** sending (button disabled with spinner), upload failed (per-photo retry), request fulfilled/removed meanwhile ("This request is no longer open").

### 14.2 Offers list (buyer)
**Entry:** My Ads > Wanted > tap a request, or the "N replies" link. **Exit:** Open chat, Mark Fulfilled, back.
**Layout:** ScreenHeader "Offers". Sub-header (white, border-bottom): request title (14px bold), budget (13px bold amber) on the left, navy **Mark Fulfilled** button on the right. Then "3 OFFERS" label and offer cards (white, radius 12, 12px padding, 10px gap): 72px photo (or placeholder tile if no photo), seller name (14px bold) + age on the right, Shop tag (gray pill) and rating "★ 4.8 (12)" or "No reviews yet", price (16px bold amber; "No price given" gray when empty), note (12.5px, 3 lines max), outlined **Open chat** button.
**Behavior:** order newest first (no sorting at launch). Mark Fulfilled opens the "Who sold it?" sheet listing the offering sellers + "Got it outside Vocksy"; chosen seller gets "Confirm you sold this" (Confirm / Not me); on Confirm the owner gets the rating modal (rules in main spec §7). After Fulfilled the list is read-only and offers stay visible 7 days like closed chats.
**Empty:** "No offers yet. Sellers who match your request will be notified." (no button).
**Not chosen:** offer sheet B (full screen), C (quick price chips); offers list B (sorted rows with sort chips; can be added later if requests get many offers), C (photo-forward cards).


---

## 15. Shop profile setup — Direction A "Single Form" (finalized 2026-10-05)
**Purpose:** let a Shop seller present their business on Mart. **Entry:** My Mart > Edit (when tag = Shop). **Exit:** Save -> My Mart; back asks to discard changes.
**Layout:** ScreenHeader "Shop details". Scrolling form, 16px padding, 18px gap, sticky navy **Save** button.
1. Info box (`#eef2f7`, radius 12): garage icon + "**Filled from your Garage.** Changes here only affect your Mart shop. Your Garage details stay as they are." Shown only when the data came from a Garage.
2. **Shop logo:** 72px rounded-14 tile (initials on navy when no logo) + outlined "Change logo" button (gallery/camera, one photo, same upload flow).
3. **Shop name** (required, max 60). 4. **About your shop** (3 lines, max 300). 5. **Phone / WhatsApp** (required; used for the "contact" buttons on the shop profile; valid Sri Lankan number). 6. **District** (picker, required). 7. **Town / address** (max 100). 8. **Website** (optional, auto-add https). 9. **Google Maps link** (optional).
10. **Wanted request alerts** switch: DISABLED (gray) with "Get notified of requests for your parts — coming soon" (Phase 2; slot reserved).
**Rules:** only Shop-tagged users can open this screen. Casual sellers see a hint row in My Mart explaining how to become a Shop (Garage account or 5+ ads in 90 days). Data lives in `MartShopProfile`, never written back to `Garage`. Seller public profile (section 16) and Detail seller row show the logo, name and Shop tag from here.
**Validation:** name required; phone required; district required; URLs must parse; logo max 5MB.
**Not chosen:** B (preview first with Edit rows), C (essentials only, more details collapsed).


---

## 16. Seller public profile (A for Shop, B for Casual — CONFIRMED)
Design board: https://claude.ai/artifact/HEsfePCa3A1XoCMUvN1Kbg (Main = A, Scroll = B, Shop = C). One screen, layout switches on seller tag.
**Opened from:** seller row on Ad detail, Followings, Shop name anywhere, chat header seller name.
**Top bar:** back arrow (navy) left; right: "..." menu (Share profile, Block user, Report user). No "..." on your own profile (shows Edit instead, see My Mart).
**Layout A (Shop):**
1. Header card (white, bottom border): logo 64x64 radius 14 (navy bg + initials if no logo) · name 17/700 · tag "Shop" (gray chip) · area/town under name (12, gray) · rating row: amber star, bold average, (count), "· Parts sales" · Follow button (navy filled; when following: white with navy border, text "Following"; tap = unfollow immediately, no confirm).
2. Contact row: two equal outlined buttons "Call" and "WhatsApp" (use shared `openPhone`, `openWhatsApp` with `shop.contactPhone` only; if the Shop has no saved shop profile hide the contact row; never fall back to the user's own phone).
3. Tabs: "Ads N | Reviews N" (amber underline 3px on active, navy bold text). Default Ads.
4. Ads tab: 2-column grid of the same ad cards as Mart Home (photo, title, price in amber). Only AVAILABLE and RESERVED ads (reserved shows Reserved tag). Sold/removed never shown. Cursor pagination, 20 per page. Empty: MartEmptyState "No ads right now".
5. Reviews tab: summary + list (same content as section 17, inline, no sheet).
**Layout B (Casual seller):** single scroll. Centered avatar 72 circle (initial) · name 18/700 · chips: "Casual seller" + "District · Member since Mon YYYY" · rating row · Follow button centered. Then "Ads (N)" with "See all" and a horizontal row of up to 3 cards (128 wide); "See all" opens the full ads grid (same as A Ads tab). Then "Reviews (N)" with "See all" and the 2 latest reviews in a white card; "See all" opens the Reviews sheet (section 17).
**Shop extras (A only):** shop description (from `MartShopProfile.about`) shown under rating row, max 3 lines; opening hours text stays inside that about text (no hours field). Website and Google Maps link show as small text links under the contact row only if set.
**Garage seller:** rating row shows "Parts sales"; a second row "Service 4.7 (20)" appears when the Garage has service ratings (tap opens Reviews sheet on the Service tab).
**Data:** `GET /mart/sellers/:sellerId` (sellerId = `User.id`, never the phone) returns displayName, district, tag (casual|shop), memberSince, logo/about/contact (if shop profile), ratingParts {avg,count}, ratingService {avg,count} or null, followedByMe, adsCount. Never return the raw phone for Casual sellers (contact is in-app chat only); Shops return their public contact phone from `MartShopProfile`.
**Rules:** blocked users cannot open each other's profile (show "Not available"); hide Follow on own profile.
**Not chosen:** C (Shop Cover: cover photo + logo overlap, description, contact, ads) — keep as a later upgrade for Shops once they have cover photos.

## 17. Reviews list (A Bottom Sheet — CONFIRMED)
Shared component `ReviewsModal` (reuse and replace the duplicated modals in GarageScreen and BookingScreen).
**Opened from:** any rating badge (profile, ad detail seller row, My Mart identity row, Reviews menu row in My Mart).
**Sheet:** white, radius 20 top, drag handle, covers from 120px below top, backdrop rgba(20,28,40,0.5), tap backdrop or swipe down to close.
1. Title "Reviews · Parts sales" (18/700 navy). Garage that also has service ratings: two tabs "Parts sales | Service".
2. Summary: big average (40/700) with 5 amber stars and "N reviews" on the left; on the right five bars (5 to 1), amber fill on gray track, count at the end of each bar.
3. List (scrolls, divider lines): per review: stars (amber), relative time (right, gray), comment (13, only if written), "Bought: <ad title at the time>" (11.5 gray). Newest first, cursor pagination 20.
**Empty:** "No reviews yet".
**Rules:** reviews are not editable or deletable by the seller; the reviewer name is not shown (privacy, same as garage reviews).
**Data:** `GET /mart/sellers/:sellerId/reviews?kind=parts|service&cursor=` returns {avg, count, distribution[5], items[]}.
**Not chosen:** B (full screen with star filter chips) — can be added later if sellers have many reviews; C (compact popup with "See all").


## 18. Followings (A Simple List — CONFIRMED)
Design board: https://claude.ai/artifact/4EoELwGVKqmPmofeaXydTk (Main = A, Tabs = B, NewAds = C).
**Opened from:** My Mart > Followings (sub-line "N sellers and shops").
**Top bar:** back arrow, title "Followings" (20/700 navy). No right-side actions.
**List:** white rows with 1px dividers, full width, ordered by most recently followed. Row (padding 14x16):
1. Avatar 46x46: Shop = rounded square (radius 12) with logo or initials; Casual = circle with initial. Navy bg, white text.
2. Name 14.5/700 + tag chip ("Shop" or "Casual seller", gray chip 10/700).
3. Area line (town/district, 12 gray). For Shops use `MartShopProfile` town; else district.
4. Rating row: amber star, bold average, (count) — Parts sales rating; hide the row when 0 reviews.
5. Right: outlined navy button "Following". Tap = unfollow immediately (row removed with a short fade; Undo toast "Unfollowed. Undo" for 4 seconds).
**Tap row** = open Seller public profile (section 16).
**Empty:** MartEmptyState: "You are not following anyone yet. Tap Follow on a seller's profile to see them here."
**Footer hint:** "Tap Following to unfollow." only when list has items.
**Data:** table `MartFollow` (see `02-data-model.md`). Endpoints (see `03-api.md` §7): `GET /mart/follows`, `GET /mart/follows/feed`, `POST /mart/follows` {sellerId}, `DELETE /mart/follows/:sellerId`. Phones are never in a URL or in a response for Casual sellers. Cannot follow yourself. Blocking a user removes the follow both ways.
**Phase 2:** "N new ads" badge and thumbnails (direction C) once a "new since last visit" count exists. Tabs (B) only if lists get long.
**Not chosen:** B (Shops | Sellers tabs), C (new-ads cards).

## 19. Wanted ad detail (A Budget Card + B photo strip + Owner view — CONFIRMED)
Design board: https://claude.ai/artifact/4EoELwGVKqmPmofeaXydTk (WantedA, WantedB, WantedOwn). A and B are ONE screen: the photo strip shows only when the request has photos.
**Opened from:** Wanted feed card, Favorites (wanted ads are heartable), notification `mart_wanted_match`, chat header for a wanted thread.
**Top bar:** back arrow left; right: heart (favorite), share, and "..." (Report request, Block user) for visitors. Owner view: no heart; share plus "..." with Delete request.
**Visitor view (top to bottom):**
1. Optional photo strip (B): horizontal scroll, 150x130 rounded 10, tap opens `MartPhotoViewer`. Max 8 reference photos as on selling ads.
2. Headline card (white, border, radius 12, padding 16): amber "Wanted" tag (amber bg, dark text) + "Posted N days ago" (11.5 gray); title 19/700; label "Budget" (12 gray) and budget in amber 22/700, formatted with `formatLKR` ("Rs. 3,000 – 5,000", single value if min equals max, "Open budget" if empty).
3. Spec card: rows Category (path with ›), Vehicle (make model year range), Condition (New / Used / Either), District, Delivery (informational). Label gray 13, value 13/600.
4. "Details" heading + note text (13.5, line-height 1.5, max 1000 chars).
5. "Requested by" card: avatar, name, "District · Casual seller · Posted N days ago", chevron; tap opens Seller public profile.
6. Sticky bottom bar: full-width navy button **I have this** opens the offer sheet (section 14.1). Hidden for own request. If the request is Fulfilled or Removed: gray text "This request is closed" instead of the button, and the page is still readable from Favorites.
**Matches you tag:** when the request matches one of the viewer's vehicles, show the "Matches you" tag next to "Wanted" (same rule as Wanted feed).
**Owner view (your own request):**
1. Same headline card with extra gray tag "Your request".
2. Offers banner (amber light bg #fdf1d2, border #f0d58a): "3 offers received" + "1 new · tap to view", chevron; opens Offers list (section 14.2). With 0 offers: "No offers yet" gray card, no chevron.
3. Spec card + details (same as visitor).
4. Bottom bar: outlined **Edit** + navy **Mark fulfilled** (opens the "Who gave you the part?" flow from section 9/14: pick the seller from offers or "Got it outside Vocksy").
**Edit:** reuses the Posting form in Wanted mode. Editing is allowed while Open. Changing category or vehicle does not remove existing offers.
**States:** Open, Fulfilled (green tag), Removed. Fulfilled and Removed requests stay visible 7 days to the owner and to sellers who made an offer, then are cleaned up by the same timestamp-based job as ads.
**Report/Block:** the top bar for visitors is heart + share only. Report request and Block user live on the Seller public profile "..." menu (section 16) and also in a "..." menu added to the top bar of this screen (visitor view only). Both open the shared Report / Block sheets (section 20). Owner view has "..." with Delete request instead.
**Data:** `GET /mart/listings/:listingId` (a wanted request is a `MartListing` with `type = wanted`) returns `isOwner`, `matchesYou`, `offersCount` and `newOffersCount` (owner only), `status`, `isFavorited`. Photos optional.
**Not chosen:** none (A and B merged).


## 20. Report, Block and Mart rules (CONFIRMED: Report A, Block B, Rules A)
Design board: https://claude.ai/artifact/YZpkfWJzMDGWL6v8Vv5nnM (Main = Report A, ReportB, ReportC, ReportDone, BlockA, BlockB, BlockedList, RulesA, RulesB, RulesC).

### 20.1 Report sheet (A Reason List Sheet)
**Opened from** the "..." menu on: Ad detail, Wanted ad detail, Seller public profile (reports the user), Chat thread header (reports the user or the ad). One shared component `MartReportSheet({ targetType: 'listing'|'wanted'|'user'|'message', targetId })`.
**Sheet:** white, radius 20 top, drag handle, backdrop rgba(20,28,40,0.5), starts 150px below top. Title "Report this ad" (or "Report this user" / "Report this request"), 18/700 navy. Sub-line "What is wrong? Only Vocksy sees your report." (12.5 gray).
**Reasons (radio list; none selected at first, Send report disabled until one is chosen; the mockup shows the first row selected only as an example):**
1. Scam or fraud — "Asks for money first, fake seller" (`scam`)
2. Fake or misleading ad — "Wrong photos, counterfeit part" (`fake`)
3. Prohibited item — "Stolen or illegal parts" (`prohibited`)
4. Spam or duplicate — "Same ad many times, unrelated" (`spam`)
5. Abusive messages — "Threats or harassment in chat" (`abuse`) — shown for user and chat reports only, hidden for ads
6. Something else — "Tell us in a few words" (`other`) — selecting it shows a text box (max 300, required for this reason)
**Dispute line (always shown, gray box radius 10):** "Vocksy cannot settle price or quality disagreements between buyers and sellers. Report scams, fakes and prohibited items only." (decision 5: no dispute handling)
**Buttons:** Cancel (outlined navy) and Send report (navy, flex 1.4).
**After send:** "Report sent" screen (check icon in green circle, title, "Thank you. We will look at it. You will not get a reply for each report."), buttons "Also block <name>" (outlined red `#c0392b`; opens Block sheet) and "Done" (navy). Not shown for own content. A toast is NOT used.
**Rules:** one open report per (reporter, target) — a second report on the same target within 24 hours shows "You already reported this" and is not saved. Cannot report yourself. Rate limit with `checkRateLimit` (10 reports per user per day).
**Data:** table `MartReport` {id, reporterPhone, targetType, targetId, targetPhone (owner of the thing), reason, note?, status ('open'|'reviewed'), createdAt}. `POST /mart/reports` → 201 `{ ok: true }`. After saving, `sendPush` to every phone in `ADMIN_PHONES`: title "New Mart report", body "<reason> · <target title>". `GET /admin/reports` (ADMIN_PHONES only) lists open reports newest first.
**Not chosen:** B (full-screen form with chips + note), C (one-tap reasons).

### 20.2 Block (B Consequences Sheet)
**Opened from:** Seller public profile "..." > Block user; Wanted/Ad detail "..." > Block user; Chat thread header "..." > Block user; Report sent screen > "Also block".
**Sheet:** starts 330px below top. Header: avatar 44 (initial) + "Block <displayName>?" (17/700) + "District · Casual seller" (12 gray). Bullets (navy dot, 13.5 gray text):
- Their ads are hidden from you, and yours from them
- Chats with them are hidden and you cannot message each other
- Follows between you are removed
- They are not told that you blocked them
**Buttons:** Cancel (outlined navy), Block user (red filled `#c0392b`, flex 1.4). After block: sheet closes, screen goes back to the previous list and a short toast-style line is NOT used (no toast component); the previous screen simply refreshes.
**Behaviour (server-enforced, not only hidden in the app):**
- `MartBlock` {id, blockerPhone, blockedPhone, createdAt}, unique pair. One row blocks both directions (the check is "either side blocked the other").
- Marketplace lists (Home, Wanted feed, search, Seller profile, Favorites) exclude listings by any user in a block pair with the viewer. Direct open by id returns 404 "Not available".
- Message send to a blocked pair returns 403 `{ error: 'Cannot message this user' }`. Existing threads disappear from both inboxes (not deleted; reappear if unblocked).
- On block: delete `MartFollow` rows both directions.
- Garage/booking features are NOT affected (block is Mart only).
**Endpoints:** `POST /mart/blocks` {sellerId}, `DELETE /mart/blocks/:sellerId`, `GET /mart/blocks` (see `03-api.md` §10).
**Not chosen:** A (simple dialog).

### 20.3 Blocked users list
**Opened from:** My Mart > Blocked users (add as a row under HELP or a new "PRIVACY" group; sub-line "N blocked"; hide the row when 0).
**Screen:** top bar "Blocked users"; rows: gray avatar 42 + name (14.5/700) + "Blocked 3 days ago" (12 gray) + outlined navy "Unblock" button (immediate, no confirm). Footer note: "Unblocking does not bring back hidden chats or follows." Empty state: "You have not blocked anyone."
**Mockup difference:** the mockup footer says "Unblocking does not bring back hidden chats or follows." DECISION (overrides mockup): chats DO reappear after unblock (data is kept), follows do NOT come back. Build the footer as "Unblocking brings back your chats, but not follows."

### 20.4 Mart rules (A Full Screen)
**Opened from:** (1) automatically before the first post, first message or first offer (see section 22 for the gate order; after Continue the action continues); (2) My Mart > Mart rules (read only: no checkbox and no Continue, just back arrow).
**Layout:** top bar "Mart rules" with back arrow; white scroll body: intro "Vocksy Mart is for car parts in Sri Lanka. Please follow these rules. Ads that break them can be removed." then seven numbered rules (circle number, title 14.5/700, description 12.5 gray):
1. No stolen parts — Sell only parts you have the right to sell.
2. No fake parts sold as original — Say honestly if a part is used, copied or repaired.
3. No illegal items — Nothing that is against Sri Lankan law.
4. Real photos and honest details — Use your own photos. Write the true condition and price.
5. No spam — One ad per item. No repeated or unrelated ads.
6. Be respectful in chat — No threats, abuse or harassment.
7. Stay safe on payment — Meet in a public place and check the part before you pay. Vocksy does not handle payments or disputes.
**Bottom bar (first-post mode only):** checkbox "I have read and agree to follow the Mart rules" and a **Continue** button, disabled until the box is ticked.
**Data:** `User.martRulesAcceptedAt` + `martRulesVersion`, set by `POST /mart/rules/accept`. `POST /mart/listings` (selling and wanted), sending a message and sending an offer return 403 `{ error, code: 'RULES_REQUIRED' }` when not accepted for the current `MART_RULES_VERSION`. Text lives in a shared constant `MART_RULES` (en now; si/ta later). If the constant version increases, ask again at the next post.
**Wording status:** the rule text is a first draft written by Claude — Vikum to review (especially rule 7 and the "not responsible for disputes" sentence). Have it reviewed legally before launch if possible.
**Not chosen:** B (before-you-post sheet with only 4 rules), C (Do / Do not lists).


## 21. Pickers (CONFIRMED: Category A, Vehicle A, District A)
Design board: https://claude.ai/artifact/QyaTCUdhrucy6Z3B4EZjju (Main = Category A, CategoryB, CategoryC, VehicleMake/VehicleModel/VehicleYear = Vehicle A, VehicleB, VehicleC, DistrictA, DistrictB, DistrictC).
**Common:** every picker is a full-screen page opened from a form row or filter row and returns the value to the caller; top bar has a close X (left) and title; search box under the bar where noted (gray rounded field, placeholder text gray, filters the list as you type, case-insensitive, no diacritics needed); rows are white, 14.5/600, 1px dividers, 14px vertical padding; the selected row is navy bold with a navy check. All lists are bundled constants in the app (no network call). Sinhala/Tamil labels come later through the same constants.
**Same pickers are used by:** Posting form, Filters screen, Wanted request form, Offer sheet (none), Shop profile setup (district only).

### 21.1 Category picker (A Expandable List)
- Title "Select category". Search "Search parts, e.g. brake pad" (searches category and type names plus a keyword list per type, so "pad" finds Brake pads).
- 12 top-level rows in this order: Engine, Brakes, Suspension and Steering, Electrical and Lighting, Body and Exterior, Interior, Transmission and Clutch, Cooling and AC, Tyres and Wheels, Filters and Fluids, Accessories, Other. Each row shows a gray sub-line of examples (e.g. "Pads, discs, calipers, drums") and a right chevron.
- Tap a row = it expands inline (chevron turns up, row text navy bold) and shows its types on a light gray panel (#f7f8fa). Only one category is open at a time. First line inside is always "All <Category>" (post or filter on the whole category). Selecting a type closes the picker and returns {categoryId, typeId}.
- "Other" has no types: tapping it returns {categoryId:'other', typeId:null} immediately.
- Search active: show a flat list of matching types, each with its category as a gray sub-line; no accordion.
- Posting requires a type or "All <Category>"; Filters allows a category only.
- Example types (Engine): Oil pump, Timing belt and chain, Gasket set, Spark plugs, Starter motor. The final full taxonomy lives in the constant `MART_CATEGORIES` ({id, label, keywords[], types:[{id,label,keywords[]}]}) — to be filled by the developer from the common Sri Lankan parts list (see Open question in the handoff) and reviewed by Vikum.
- Not chosen: B drill-down (second screen), C icon grid.

### 21.2 Vehicle picker (A Searchable Steps)
- A 3-step flow, each step a full screen with sub-title "Step N of 3": Make → Model → Year. Back arrow goes one step back; X closes without saving.
- **Step 1 Make:** search "Search make". Section "POPULAR IN SRI LANKA" (Toyota, Suzuki, Honda, Nissan, Mitsubishi, Mazda — order is a constant) then "ALL MAKES" A–Z. Source: bundled `BRAND_MODELS` plus extra makes common in Sri Lanka (Micro, Daihatsu, Tata, Mahindra, Kia, Hyundai, BMW, Mercedes-Benz). Tapping a make goes to step 2.
- **Step 2 Model:** title = make name. Search "Search model". First row "All <Make> models" with sub-line "Fits all models" (selecting it skips step 3 and returns model=null, years=null). Then the models A–Z. Tapping a model goes to step 3.
- **Step 3 Year:** title = model name. Two boxes "Year from" and "Year to" (the active box has a 2px navy border). A grid of year chips (newest first, from the current year down to 1980; chips 70px wide, wrapping to fit the row) — tap the first year then the last year; the range highlights navy. Tap one year twice = single year (from = to). A link "Fits all years" (navy bold) clears the range. Bottom button "Done · Toyota Axio 2012–2015" (navy; text reflects the selection) returns {make, model, yearFrom, yearTo}.
- Posting: Make required; Model and Year optional ("fits all" allowed). Filters: all optional. A listing may have ONE compatible vehicle in Phase 1 (multiple vehicles = Phase 2; seller can write others in the description).
- Editing from the form row: the row shows "Toyota Axio 2012–2015" (or "Toyota · all models"); tapping reopens at step 1 with the current values preselected.
- Not chosen: B tabbed sheet, C quick chips.

### 21.3 District picker (A Searchable List)
- Title "District". Search "Search district". Single-choice radio list (navy ring + dot on selected).
- First row: "Your district: <name>" (the user's profile district, selected by default) shown only when the user has a district; then the other districts A–Z. All 25: Ampara, Anuradhapura, Badulla, Batticaloa, Colombo, Galle, Gampaha, Hambantota, Jaffna, Kalutara, Kandy, Kegalle, Kilinochchi, Kurunegala, Mannar, Matale, Matara, Monaragala, Mullaitivu, Nuwara Eliya, Polonnaruwa, Puttalam, Ratnapura, Trincomalee, Vavuniya.
- Tap = select and close immediately (no Done button).
- Filters screen reuses it with an extra first row "All Sri Lanka" and allows multiple districts: in that mode rows use checkboxes and a bottom button "Apply (N)". (Filters can start single-choice in Phase 1: DECISION to confirm at build; recommended = single choice + "All Sri Lanka".)
- The district constant (`DISTRICTS`, en/si/ta labels) is created in Step 0 and is the single source for User.district, listings, Shop profile and filters. Store the English id (e.g. "colombo"), never the label.
- Not chosen: B grouped by province, C chip grid sheet.

---

## 22. First-action gates (name, district, rules) and error handling

**Gate order** for the first post, the first message and the first offer (whichever the user does first):
1. If `displayName` or `district` is missing: show the **Name and district sheet**: bottom sheet, title "Before you start", field "Your name" (2–40 chars; hint "Others will see your first name and last initial"), district field (opens the district picker, section 21.3), navy button "Continue". Saves with `PATCH /mart/me`.
2. If rules are not accepted for the current version: show the **Mart rules** screen in first-action mode (section 20.4), with the checkbox. Saves with `POST /mart/rules/accept`.
3. Then continue the action the user started (the post, message or offer is not lost).
If the server still answers `PROFILE_REQUIRED` or `RULES_REQUIRED` (for example the rules version changed), open the same sheet or screen and retry once.

**Mart tab hidden:** when `GET /app-config` says `martEnabled: false`, the Mart tab is not shown and no Mart screen is reachable (including from notification taps: fall back to the vehicle list).

**Error and empty states (every Mart screen):**
- Loading: skeleton cards (feed) or a centered spinner (detail, chat). Never a blank screen.
- Network error: `MartEmptyState` with "Couldn't load. Check your connection." and a Retry button. Writes keep the form state and show an inline red message plus the button again.
- 404 on an ad or profile: `MartEmptyState` "This ad is no longer available" (or "Not available" for profiles) with a Back button.
- 429: toast "Too many tries. Please wait a few minutes."
- Offline: no offline queue in Phase 1; actions fail with the network error state.
- Dark mode: every screen uses theme tokens (section 0.1b), no hard-coded hex values in code.


---

## 23. Corrections and additions (these OVERRIDE any older text above)

A cold-read review of the package found the points below. Where a section above says something different, this section wins.

**Copy, labels and small rules**
1. Show the **district label only** (for example "Colombo"). Ignore sub-areas such as "Colombo 5" in the mockups.
2. Budget on a Wanted post is optional; empty means "Open budget". Price placeholder is `e.g. 3500` (whole rupees only).
3. Wanted ads have no condition and no delivery. Remove those rows from the wanted detail. Description max is 3000 characters. Fulfilled tag uses the theme success color token. Closed ads are hidden by date comparison; there is no cleanup job.
4. "Matches you" is based on the viewer's own past selling ads (same category, and same make when the request has one), never on the viewer's registered vehicles.
5. On a request card, "I have this" opens the **Offer sheet** (14.1). Ignore any text about a prefilled chat message.
6. Year pickers list current year + 1 down to 1950.
7. In the Filters screen the district is a single choice. In Posting the district is a single choice.
8. The picker for Vehicle shows all makes from the catalog. A make with no model list (or the extra row "Other" at the end of the make list) shows a text field "Type the model" (max 40) and stores `make` or `"Other"` plus the typed model. Extend `mobile/src/constants/vehicleData.ts` with the extra makes (Micro, Daihatsu, Tata, Mahindra, Kia, Hyundai, BMW, Mercedes-Benz) and keep the backend `vehicleCatalog.ts` identical.
9. Category constant shape is the one in `02-data-model.md` §8.3 (`en`, `si?`, `ta?`, `categoryTypeId`). The example types in 21.1 are illustrations only.
10. Error and empty strings use the `03-api.md` wording ("You can't message this user", "This ad is no longer available", profiles: "Not available").

**Chat and deals**
11. "Message Seller" opens a **draft chat screen** (no thread yet) with the prefilled text "Hi, is this still available?". The thread is created only when the buyer taps send. If a thread already exists, open it.
12. Blocked threads are unreachable (the server refuses them), so there is no "You blocked this user" composer. The block/unblock controls live on the seller profile and the Blocked users list.
13. System lines in a chat: "Marked as sold", "Marked as fulfilled", "Purchase confirmed". Reserve, available and relist create no system line.
14. **Wanted deal, partner side:** after the requester picks a seller, that seller sees a banner in the thread "<name> says you supplied <title>. Confirm?" with **Yes, I sold it** and **Not me**. After the seller confirms, the requester sees the **Rate** banner in the same thread (the notification opens the thread).
15. The "Who bought it?" / "Who sold it?" sheet lists everyone who chatted (from `GET .../buyers`) and shows a small "Can rate" or "Needs a reply first" hint per person (`canRate` in the response). The Offers list (14.2) shows only offer messages. "Replies" on My Ads means chats; "Offers" means offer messages.
16. Rating is possible only after both people have sent a message. If not, the Rate button shows "Chat with the seller first".
17. Chat "..." menu: Delete conversation, Report (reports the user, reason Abuse available, or the ad), Block user. Reporting a single message is API-only for now (no UI).
18. Detail screen for a Wanted ad shows heart, share and "..." (Report, Edit if owner). Report on a wanted ad sends `targetType: "listing"`.
19. Report reasons are exactly those in 20.1 (Scam, Fake, Prohibited, Spam, Abuse, Other). Delete any shorter reason list in other sections.

**Screens not drawn earlier (build them simply, in the app's existing style)**
20. **My Mart > Edit** (name, district, profile photo) with a **Delete my account** row at the bottom. Delete account: warning text listing what is removed (ads, chats, ratings, favorites, follows), a text field where the user types `DELETE`, a red button. Then call `DELETE /auth/account` and sign out.
21. **Notification settings:** add three switches under the existing push settings: "Messages and offers" (`mart_message`), "New requests near you" (`mart_wanted`, replaces the "coming soon" row in Shop setup), "New reviews" (`mart_rating`).
22. **Admin report notification** appears in the list with a flag icon and does nothing on tap.
23. **Toasts:** use the minimal `MartToast` from Step 0.10 for "Undo" (unfollow) and short confirmations.
24. **Names:** a Shop shows `MartShopProfile.name` (else the full `displayName`, never `Garage.name`). A Casual seller shows "Kasun P." (first name + last initial). A seller can change from Casual to Shop automatically, so the name format can change.
25. The seller `verified` flag from the API is not displayed anywhere in Mart.
26. Customer Service row is WhatsApp only (no call).
27. Reviews list: the line under each review reads "For: <ad title>". `martReviews` notification opens My Mart with the Reviews modal open for your own profile.
28. Favorites screen header "N saved" comes from `count` in the favorites response; chips are All | Available | Sold / Removed mapped to `filter=all|available|closed`. Favorites mix selling and wanted ads.
29. In Seller profile "Layout A" and "B", the Ads list uses `GET /mart/sellers/:sellerId/listings`; the chat "More from <seller>" strip uses `GET /mart/listings/:listingId/more-from-seller`.
