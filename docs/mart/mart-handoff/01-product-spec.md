# Vocksy Mart — 01 Product Spec

Part of the developer package. This is the short "what and why". Details live in `02-data-model.md` (data), `03-api.md` (API), `04-screens.md` (screens), `05-build-plan.md` (order of work). Status: 2026-10-05. Everything here is confirmed by Vikum unless marked **(proposed)**.

---

## 1. What Mart is

**Vocksy Mart** is a vehicle **parts marketplace inside the existing Vocksy app** (Sri Lanka, English now, Sinhala and Tamil later). It is not a separate app: same login, same backend, same database, same accounts (vehicle owner and garage owner). Prices are in **LKR**. Payment and delivery happen **outside** the app (cash or bank transfer, meet or courier); Mart only connects people.

Competitors (ikman.lk, riyasewana.com) are general classifieds. Mart's long-term edge is Vocksy's maintenance data (not in scope now).

**Who uses it:** any registered Vocksy user can sell or buy. Garage owners get a "Shop" look (below). Same Mart for both account types.

## 2. Main things a user can do

| Area | What the user does | Spec |
|---|---|---|
| Browse | Grid of ads, category chips, search, filters (category, vehicle make/model/year, condition, price, district), sort | 04 §1, §4 |
| Post | Selling ad (photos, category, condition, vehicle fit, title, description, price, district, delivery toggle) | 04 §2 |
| Wanted | "I need this part" requests with a budget. Sellers see requests, send an offer, chat | 04 §12, §14, §19 |
| Detail | Photos, price, seller card, similar parts, Message Seller, favorite, share, report | 04 §3 |
| Chat | One chat per ad per buyer. Offers, messages, system lines. Inbox with unread dots | 04 §5, §6 |
| My Ads | Active and Sold tabs. Edit, Reserve, Mark sold, Relist, Delete | 04 §7 |
| Sale + rating | Seller marks sold and picks the buyer. Buyer confirms, then rates the seller | 04 §9 |
| Favorites | Heart an ad, list with Sold/Removed labels | 04 §10 |
| Sellers | Public seller profile, reviews, follow, Shop profile for garages | 04 §15 to §18 |
| Safety | Report, Block, Mart rules | 04 §20 |
| Notifications | Mart notification list and push | 04 §13 |

## 3. Key rules (the ones that surprise people)

1. **Phone numbers are private.** Casual sellers are reached only through in-app chat. Only Shops publish a contact phone, and only the one they typed in their shop profile. No phone number in any URL or API response about another person (public id = `User.id`).
2. **Seller tag Shop vs Casual** is automatic: Shop = the user owns a Garage account OR has 5+ ads in the last 90 days. It is separate from the existing `Garage.verified` badge (which means business registration checked). Mart never shows "Verified" for the Shop tag.
3. **Ratings** come only from confirmed deals: the seller marks the ad sold and picks the buyer (or "Sold outside Vocksy", which allows no rating); the buyer confirms ("Yes, I bought it"), then may rate 1–5 stars with an optional comment. For a Wanted request the roles flip: the requester picks the seller who supplied it, that seller confirms, and the requester rates. One rating per buyer–seller pair, ever. Both people must have sent at least one message in the chat first (an offer counts as the seller's message).
4. **Offers, not bidding.** A seller answering a Wanted request sends one offer (price, note, up to 3 photos). It appears as the first message of a chat. No auction.
5. **Sold or removed ads** stay readable in chats for 7 days, then disappear from the inbox (they stay in Favorites, grayed, until the user removes them). This is calculated from timestamps when data is read. There is no timer job.
6. **Blocking** hides each person's ads and chats from the other. The blocked person is not told. Chats come back if you unblock; follows do not.
7. **Reports** are for scams, fakes, prohibited items, spam and abuse, not price disagreements. Reports go to a table plus a push notification to Vikum (`ADMIN_PHONES`). There is a read-only `GET /admin/reports`. No email exists in the app.
8. **First post / first message gate:** name + district, then the Mart rules checkbox (once, versioned).
9. **No payments, no delivery system, no deposits.** "Can arrange delivery" is an information badge only.
10. **Customer Service** row is hidden until `MART_SUPPORT_WHATSAPP` is set (no number yet).
11. **For You, saved filters, specialty picker** are Phase 2. Recent searches ARE stored from day one.

## 4. Scope and release plan

Everything in this package is in scope for launch, built and shipped in three milestones, all behind the beta gate (`MART_BETA_PHONES`). Details in `05-build-plan.md`.
- **M1:** profile, post/edit/delete, photos, browse/search/filters, favorites, chat + inbox, My Ads, My Mart.
- **M2:** Wanted + offers, sold/confirm/ratings, Shop + seller profile + reviews, Followings, notification center + push.
- **M3:** Report, Block, rules, account deletion, backups, then public launch.

**Out of scope:** payments, delivery logistics, auctions, in-app calling, email, web version, deep links, admin web portal, automatic fake-ad detection, Verified-part history from maintenance records.

## 5. Project constraints

- **Solo founder, $0 budget.** Use the existing free stack (Render free, Neon free, Cloudflare R2). No new paid service. No new dependency unless it is needed (avoid adding a navigation library; extend the existing manual `Screen` union in `App.tsx`).
- **Sri Lanka first:** LKR (`Rs. 3,500`), district list of 25, Sri Lankan vehicle makes/models, English now with Sinhala and Tamil via the existing i18n setup.
- **Brand:** navy `#1d3a5f` + amber `#e3a008`, using the existing theme tokens and dark mode (`mobile/src/theme/colors.ts`). The code palette is the source of truth.
- **App name** is **Vocksy** (DriveVault is retired). Header title on the Mart home reads "Vocksy Mart"; the tab label is just "Mart".
- **Existing users and data must not break.** All database changes are additive. Mart is invisible until the beta gate opens.

## 6. Glossary

- **Ad / listing:** a `MartListing` row. `type = selling` (a part for sale) or `wanted` (a request).
- **Seller / buyer:** for selling ads, owner = seller. For wanted requests, the owner is the **requester (buyer)** and the people answering are sellers.
- **Shop / Casual:** computed tag for a seller (section 3.2).
- **Thread:** the chat for one ad and one other person.
- **Deal:** the sold/fulfilled record on an ad (partner, outside flag, confirm state).
- **Beta gate:** `MART_BETA_PHONES` env var; empty means everyone.
- **Step 0:** prerequisite tasks in `05-build-plan.md` done before any Mart screen.
