# TechVehicle — Master Product Roadmap

Last updated: 2026-06-24

---

## Product Vision

TechVehicle is a mobile application for vehicle maintenance tracking, service history sharing,
and verified vehicle history transfer. It is being built for the Sri Lankan market first, with
currency in LKR, vehicle identifiers as registration numbers, and service intervals calibrated
for Sri Lankan vehicle models and driving conditions.

Long-term, TechVehicle is the first of two products built on shared infrastructure:

| Product | Description | Status |
|---|---|---|
| **TechVehicle** | Vehicle owner + garage management app | In development |
| **ShopSL** (working name) | White-label SMB marketplace app for Sri Lankan businesses | Planned — Phase 12 architecture feeds into this |

---

## Current State — What Is Built (Phases 0–5)

All of the following are complete, committed, and pushed to GitHub.

### Authentication
- Phone number + OTP login (console OTP in dev)
- JWT stored in SecureStore
- Role selection at first login: Vehicle Owner or Garage/Service Center

### Vehicle Management
- Add vehicle (registration number, make, model, year, fuel type, mileage)
- My Vehicles screen with vehicle cards
- Vehicle Dashboard: blue card with mileage, 2×2 quick action grid, sparkline analytics mini-cards
- Inline odometer update from dashboard
- Bottom tab bar: My Vehicles tab + Garage tab

### Service Records
- Add Service Record with tap-to-select categories, per-item brand tracking, cost, mileage
- Compact history cards on dashboard
- Mileage validation against current odometer

### Fuel Logs
- Log fuel fill-up: odometer, litres, cost, full/partial tank, station
- Historical fuel entries supported (yellow info card when mileage < current)
- km/L insight card
- Odometer auto-updates on new fill-up

### Expenses
- Tap-to-select categories: Insurance, Revenue Licence, Emission Test, Fine, Parking, Toll, Accessories, Washing, Other

### Analytics
- SVG charts: Mileage Growth, Fuel Efficiency, Cost per Fill-up
- Sparkline mini-cards on Vehicle Dashboard

### Share Engine
- Owner selects records → searches garage → confirms → shares read-only view
- Garage sees incoming shared vehicle profile + service records

### Sell / Transfer Engine
- Owner enters buyer phone → all records transfer → buyer accepts
- Buyer previews full vehicle history before accepting
- Transfer is irreversible once accepted (tamper-evident)

### Garage Module
- Garage registration with optional BR number (verified/unverified badge)
- Schedule tab: work days toggle, max per day counter, time slots editor
- Monthly calendar with per-day overrides (Open/Closed/Holiday, custom slots, coloured messages)
- Garage service submission: full tap-to-select form → sends to owner for approval
- Owner acceptance: pending submissions on dashboard → Accept saves permanently
- Garage Bookings tab: colour-coded booking cards, expand to see shared records, Submit Completed Service button
- Garage Calendar tab: monthly view of booked/max with colour coding, tap date for day's bookings

### Booking System
- Owner searches garage → date picker (14 days, shows override messages) → time slot selection
- Normal/Urgent toggle, optional attach service history
- Slot blocking: one booking per time slot
- Booking linked to ShareSession

### Prediction Engine (Phase 5)
- Service interval database: General, Bajaj/TVS/Hero, Toyota, Honda, Mitsubishi, Suzuki, Nissan
- Make-level, model-level, and year-range level interval overrides
- Chain engine detection: Toyota Prius/Aqua/Yaris excluded from timing belt predictions
- Predictions screen: three sections (Needs Attention, On Track, No History)
- Predictions card on Vehicle Dashboard: top 3 urgent items
- Service-due push notifications fired at login

### Push Notifications
- Expo push token registration at login
- Infrastructure: garage notified on booking, owner notified on garage confirmation
- Service-due alerts: overdue and due-soon push on login
- Note: end-to-end delivery requires a development build (EAS Build) — Expo Go SDK 53 limitation

### Database (Neon / PostgreSQL via Prisma)
Tables: `User` (with `userType`, `pushToken`), `Vehicle`, `ServiceRecord`, `FuelLog`,
`Expense`, `Garage`, `ShareSession`, `ServiceSubmission`, `VehicleTransfer`,
`GarageAvailability`, `GarageCalendarOverride`, `Booking`

---

## Remaining TechVehicle Phases

---

### Phase 6 — Core Gaps & Polish
**Priority: Do first | Estimated: 3–4 weeks**

Holes in the existing product that affect every current user. Complete before adding new epics.

| Task | Source |
|---|---|
| Service type selection before sharing: Full Service / Between Service / Third-Party | Epic 3 (PDF) |
| Owner ↔ Garage notes/comments thread on a booking (back-and-forth before accept) | Epic 3 Story 4 |
| Vehicle form: add purchase date, first/second owner count, personalized notes field | Epic 2 (PDF) |
| My Vehicles: search and filter (by make, model, reg number) | Epic 2 (PDF) |
| Notification preferences screen (manage what push alerts you receive) | Epic 3 Additional Notes |
| Garage push notification when owner accepts a submission (records saved to repository) | Epic 3 Story 5 |

---

### Phase 7 — Media & Export
**Priority: Do second | Estimated: 3–4 weeks**

Unlocks the "shareable proof" concept that is core to the product identity. Without photos and PDFs, the record is text-only. These are required before Rental and Marketplace can be credible.

| Task | Source |
|---|---|
| Photo attachments on service records — upload to Cloudflare R2, compressed to 200–400 KB | Epic 2, CLAUDE.md |
| Receipt/photo viewer on service record detail | Epic 2 |
| PDF maintenance record export — generate and share via native share sheet | Epic 2 Story 3 |
| Historical data onboarding wizard — guided entry for new users with existing vehicles | Epic 2, CLAUDE.md |

---

### Phase 8 — Vehicle Buying Marketplace
**Priority: High | Estimated: 5–6 weeks**

Natural extension of the Sell/Transfer engine already built. The marketplace is the public-facing layer on top of it. This is the highest-value new epic for vehicle owners.

| Task | Source |
|---|---|
| Owner lists vehicle publicly for sale: price, description, photos | Epic 5 (PDF) |
| Marketplace browse screen: filters by make, model, year, fuel type, price range | Epic 5 Story 1 |
| Verified maintenance records attached to listing — badge showing history is app-verified | Epic 5 Story 2 |
| Contact seller in-app (reveal phone or in-app message) | Epic 5 Story 1 |
| AI-suggested price based on vehicle history, mileage, and market data | CLAUDE.md Vision |
| Pre-purchase technical expert request — link to Phase 10 Tech Guy feature | Epic 5 Story 3 |

---

### Phase 9 — Vehicle Rental Marketplace
**Priority: Medium-High | Estimated: 4–5 weeks**

Shares browse/listing/contact infrastructure with Phase 8. Build after Phase 8 so patterns are established.

| Task | Source |
|---|---|
| Vehicle owner lists vehicle for rent: availability dates, daily/weekly price, conditions | Epic 4 Story 1 |
| Attach maintenance records to rental listing (subscription-gated full view) | Epic 4 Story 2 |
| Search and browse rentals: filters by location, make, model, price | Epic 4 Story 3 |
| Renting company multi-vehicle management (list many vehicles, separate company tab) | Epic 4 Stories 4 & 5 |
| Contact owner or company in-app | Epic 4 Additional Notes |

---

### Phase 10 — Technical Expert (Tech Guy)
**Priority: Medium | Estimated: 4–5 weeks**

Third user role. Required to complete Phase 8 pre-purchase inspection story and standalone value for breakdown support.

| Task | Source |
|---|---|
| Tech Guy as third role at registration (alongside Vehicle Owner and Garage) | PDF page 12 Note |
| Tech Guy profile: qualifications, expertise, location, availability, machinery available | Epic 6 Story 1 |
| Location-based tech guy search from vehicle owner side | Epic 6 Story 2 |
| In-app messaging between owner and tech guy | Epic 6 |
| Owner rates and reviews tech guy after session | Epic 6 |
| Tech guy verification badge (similar to garage BR number badge) | Epic 6 Additional Notes |

---

### Phase 11 — Auto Glossary & Self-Help Guide
**Priority: Medium-Low | Estimated: 2–3 weeks**

Content-heavy, technically simple. Increases app stickiness and helps non-technical owners understand service records and garage advice.

| Task | Source |
|---|---|
| Searchable auto glossary: terms, definitions, symptoms, basic troubleshooting steps | Epic 7 Story 1 |
| Self-help guides for common breakdowns: flat tyre, dead battery, overheating, coolant loss | Epic 7 Story 2 |
| Text + images per guide, categorized by issue type and vehicle component | Epic 7 |
| Download guides for offline access — critical because breakdowns happen without signal | Epic 7 Additional Notes |

---

## Phase 12 — Auto Parts Marketplace (Dual-Product Strategy)

**Priority: After Phase 9 | Estimated: 8–10 weeks**

### The Strategic Decision

Phase 12 will **not** be built inside TechVehicle's existing backend and mobile codebase.
It will be built as a **completely separate, standalone product** from day one.

**Why:**
- TechVehicle is the first customer of the marketplace, not the owner of it
- The marketplace will be extracted and rebranded as a separate SMB app for Sri Lankan businesses
- If built inside TechVehicle, extraction later becomes a painful rewrite
- Building it separately now costs only a small amount of extra architecture effort

---

### The Two Products

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│     TechVehicle App         │     │   ShopSL App (working name)  │
│                             │     │                              │
│  Vehicle management +       │     │  White-label SMB marketplace │
│  Auto Parts tab             │     │  for any Sri Lankan business │
│  (auto parts category only) │     │  (all categories)            │
└──────────────┬──────────────┘     └───────────────┬──────────────┘
               │                                    │
               └────────────────┬───────────────────┘
                                ▼
               ┌────────────────────────────────┐
               │    Marketplace Backend          │
               │    (separate service)           │
               │                                │
               │  - Multi-tenant shop registry  │
               │  - Product listings            │
               │  - Orders & Cart               │
               │  - Reviews & Ratings           │
               │  - Shop analytics              │
               └────────────────────────────────┘
```

---

### Architecture Rules for Phase 12

| Rule | Detail |
|---|---|
| Separate repository (or isolated monorepo package) | `/marketplace-backend` and `/marketplace-mobile` are never mixed into `/backend` or `/mobile` |
| Separate Neon database | Marketplace has its own database. No vehicle data mixed with shop/order data. |
| Multi-tenant from day one | Every shop is a tenant. TechVehicle passes `category=auto-parts` filter. ShopSL shows all. |
| Shared phone auth | A TechVehicle user's phone number works in the marketplace without re-registering |
| White-label config file | App name, logo, primary colour, allowed categories — one config swap = different branded app |
| Cash on delivery first | COD is the dominant payment method in Sri Lanka. Payment gateway (PayHere/IPG) added later. |

---

### Phase 12 — Feature List

| Task | Source |
|---|---|
| Marketplace backend: separate Node.js service, separate DB, multi-tenant shop model | Architecture |
| Shop owner role — fourth user type (Vehicle Owner / Garage / Tech Guy / Shop Owner) | Epic 8 (PDF) |
| Shop registration: business name, category, address, contact, branding | Epic 8 Story 2 |
| Product listings: name, description, images (Cloudflare R2), price, stock level | Epic 8 Story 2 |
| Vehicle compatibility filter on products (uses make/model/year from user profile) | High-value extension |
| Browse and search: filters by part type, brand, compatibility, price | Epic 8 Story 1 |
| Shopping cart — add, update quantity, remove | Epic 8 Story 1 |
| Checkout — COD first, PayHere payment gateway later | Epic 8 Story 1 |
| Order management for shop owners: view orders, mark fulfilled, track inventory | Epic 8 Story 2 |
| Shop analytics: sales by day/week/month, top products, revenue | Epic 8 Story 2 |
| Comments and reviews on shops (text + star rating + optional image) | Epic 8 Story 3 |
| Star ratings per shop, average shown on listing, influences ranking | Epic 8 Story 4 |
| Shop owner responds to reviews | Epic 8 Story 3 |
| TechVehicle integration: auto-parts tab in TechVehicle app connects to marketplace backend | Integration |

---

### ShopSL — Second Product (Extraction from Phase 12)

After Phase 12 launches inside TechVehicle:

1. New Expo project created with different `app.json` (name, slug, icon, colours)
2. Marketplace mobile screens imported — same code, new config
3. All product categories enabled (groceries, hardware, clothing, electronics, etc.)
4. Targeted at Sri Lankan SMBs with no current digital presence
5. Same backend, same database — shop owners registered in TechVehicle marketplace
   automatically appear in ShopSL

**ShopSL value proposition for businesses:**
- Phone-number login — no website, no email required
- List products in minutes
- Customers order through the app, pay on delivery
- Reviews and ratings build trust
- Sales analytics on mobile

---

## Complete Roadmap Summary

| Phase | Topic | Weeks | Priority |
|---|---|---|---|
| ✅ 0–5 | Foundation through Prediction Engine | Done | — |
| 6 | Core Gaps & Polish | 3–4 | 🔴 Start now |
| 7 | Media & Export (photos, PDF, onboarding wizard) | 3–4 | 🔴 Start now |
| 8 | Vehicle Buying Marketplace | 5–6 | 🟠 After 7 |
| 9 | Vehicle Rental Marketplace | 4–5 | 🟠 After 8 |
| 10 | Technical Expert (Tech Guy) | 4–5 | 🟡 After 9 |
| 11 | Auto Glossary & Self-Help | 2–3 | 🟡 After 9 |
| 12 | Auto Parts Marketplace (separate product architecture) | 8–10 | 🟢 After 10–11 |
| — | ShopSL standalone app (derived from Phase 12) | 1–2 | 🟢 After Phase 12 |

**Total remaining estimate: ~35–46 weeks** at current development pace.

---

## How We Are Building This

- **Developer:** Vikum, session by session with Claude
- **Method:** Feature by feature, end-to-end (backend + mobile) before moving to next
- **Environment:** GitHub Codespaces (editor), Neon (PostgreSQL), Expo Go (mobile preview)
- **Workflow:** Claude writes files locally → git commit and push → Codespace does git pull
- **Code lives at:** `c:\Vikum\TechVehicle` (local), GitHub (remote), Codespace (dev runtime)

### Session Start Commands

```bash
# Set environment (run every Codespace session — .env is wiped on restart)
cat > /workspaces/TechVehicle/backend/.env << 'EOF'
PORT=3001
JWT_SECRET=dev-secret-change-in-production
DATABASE_URL="postgresql://neondb_owner:npg_rTfoMUK98SFD@ep-falling-salad-ao50kj3h-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
EOF

# Sync DB schema (run after any Prisma schema change)
cd /workspaces/TechVehicle/backend && npx prisma db push

# T1 — Backend
cd /workspaces/TechVehicle/backend && npm run dev

# T2 — Mobile (separate terminal)
cd /workspaces/TechVehicle/mobile && EXPO_PACKAGER_PROXY_URL=https://$CODESPACE_NAME-8081.app.github.dev npx expo start --clear
```

---

## Key Design Decisions (Locked)

| Decision | Resolution |
|---|---|
| Vehicle identifier | Registration number (primary), VIN (optional) |
| Currency | LKR — Sri Lankan Rupee |
| Mileage unit | Kilometres (km) |
| Launch market | Sri Lanka |
| Auth method | Phone number + OTP only |
| Sell transfer | All records removed from seller, added to buyer — irreversible once accepted |
| Dispute handling | No reject/dispute button — resolved in person between owner and garage |
| Photo storage | Cloud (Cloudflare R2), compressed to 200–400 KB |
| Garage BR number | Optional — used only for verified/unverified badge |
| Garage dual role | Garage owners can also register and manage personal vehicles |
| Phase 12 architecture | Separate backend service and mobile package — never embedded in TechVehicle codebase |
| ShopSL strategy | Derived from Phase 12 marketplace — same backend, rebranded mobile config |
| Payment — Phase 12 launch | Cash on delivery first, PayHere payment gateway in a later iteration |
