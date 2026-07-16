# TechVehicle

Intelligent vehicle maintenance tracking, expense management, service history sharing, and verified vehicle history transfer — built for Sri Lanka.

---

## Development Progress

Last updated: 2026-06-30

### Completed ✅

**Core Engine**
- Phone auth (OTP + JWT, stored in SecureStore)
- Multi-vehicle management — add, edit, photo, vehicle type (12 types)
- Vehicle Dashboard — blue card, quick actions, sparkline analytics mini-cards
- Service Record Engine — vehicle-type-filtered categories, per-item brands, structured data capture (oil brand, tyre size, emission readings, AC refrigerant)
- Fuel Log — odometer, litres, cost, km/L insight card
- Expense Tracking — categorised (Insurance, Revenue Licence, Emission Test, Fine, Parking, Toll, Accessories, Washing, Other)
- PDF Export — full service + fuel + expense history with cost summary
- Photo Attachments — Cloudflare R2 storage, swipeable full-screen gallery viewer
- History Screen — full search + date/category/mileage filters on all 3 tabs (Service, Expenses, Fuel)

**Intelligence Layer**
- Prediction Engine — curated service interval DB covering Toyota (Prius, Corolla, Axio, Aqua, KDH, Fielder, Allion, Premio, Vitz), Honda (Vezel, Fit, City, CB125R, CB Shine), Suzuki (Alto, Wagon R, Swift), Bajaj (RE, Pulsar 150/220), TVS (Apache, King), Hero (Splendor), Yamaha (R15), Nissan (Leaf), plus GENERIC_MOTO fallback
- Dashboard top-2 prediction cards (overdue / due soon) with detail bottom sheet
- Service Interval Personalisation — per-vehicle km/days override stored on Vehicle
- Insights Screen — SVG charts: Mileage Growth, Fuel Efficiency, Cost/Fill-up, Monthly Spend, Cost/km
- Structured Analytics Cards — Oil History, Tyre History (km per set), Emission History (HC/fail warnings), AC Refill (leak frequency warning)
- Anomaly Detection — AC leak frequency, battery replacement, oil interval, repeated categories
- Knowledge Hub — searchable manufacturer spec DB with oil grade, tyre size, service intervals; "My Vehicle" comparison tab vs manufacturer recommendation

**Renewal & Reminders**
- Emission Test expiry — dashboard banner + push+bell reminders every 3 days from 30 days before expiry
- Revenue Licence expiry — same pattern
- Insurance expiry — same pattern + editable fields (company, policy number, expiry) in Edit Vehicle modal

**Sharing & Transfer**
- Sell / Transfer Engine — full record transfer to buyer, buyer preview, pending state
- Share Engine — owner selects records → garage read-only view
- Family / Shared Access — share vehicle access with another phone number (read + submit)
- Shared user submit flow — emission test + wheel alignment submitted for owner approval
- Owner Pending Approvals — Accept / Reject with push+bell notifications (garage and shared user submissions)

**Garage Module**
- Garage registration with verified/unverified BR badge
- Schedule management — work days, max per day, time slots, monthly calendar overrides with colour-coded messages
- Booking System — 14-day date picker, slot blocking, normal/urgent note toggle, optional attach service history
- Garage Bookings tab — colour-coded cards (pending/confirmed), inline shared records, Submit Completed Service
- Garage Calendar tab — booked/max per day view, tap date to see bookings

**Specialist Screens**
- Vehicle Tests Screen — Emission tab, Wheel Alignment tab, Chain Service tab, Insurance tab, Revenue Licence tab (each: pinned status card + history list)
- Log Emission Test — dedicated quick-action button on dashboard
- Three-Wheeler Daily Trip Log — start/end odometer, fuel, earnings, cost-per-km and profit
- Vehicle Profile Card — purchase date, owner count, vehicle notes (editable)
- Role Selection — Vehicle Owner or Garage/Service Center on first login
- Cost Forecast Screen — upcoming 12-month estimated spend, grouped by services with/without cost data
- Onboarding Wizard — 2-step wizard (vehicle-type-filtered milestones → quick-add past records) shown after first vehicle add
- Vehicle Profile Completion Score — progress bar on dashboard nudging users to fill in history gaps
- Mileage Reminder Push — daily cron nudges users if no fuel log or service in 7 days

---

## Remaining Tasks

### UI Polish — Fixed (2026-06-30) ✅

All 6 UI issues found during testing were fixed and pushed in commit `9081ea2`:
- Insurance/RL tabs: left-border card style, consistent with other pinned cards
- Dashboard renewal banners: explicit `marginBottom` per card for reliable Android spacing
- Cost Forecast "Other Due Services": added "+ Log Service" button → navigates to Add Service Record
- Onboarding Wizard Step 1 & 2: `KeyboardAvoidingView` wrapping so keyboard no longer hides fields
- Onboarding Wizard Step 1: button turns **green** when data is entered, stays **blue** when just expanded with no data

### Lower Priority / Future

| Task | Description |
|---|---|
| **PDF branding** | Logo + brand colour needed before redesign — deferred pending design decision |
| **Sinhala language** | Phase 2 — large segment of Sri Lankan market |
| **OBD-II Bluetooth** | Premium tier — ELM327 adapter for automatic mileage capture |
| **Vehicle Marketplace** | Phase 6 — list vehicles for sale with verified history attached |
| **AI natural language Q&A** | "When did I last change my brake pads?" answered from history |
| **Garage discovery / map** | Two-path location system: (1) garage searches for their existing Google Maps listing via Places Autocomplete → auto-fills address + coordinates + links `place_id`; (2) garage drops a pin on the map if not yet on Google Maps → stored as lat/lng, discoverable in TechVehicle immediately without waiting for Google Business Profile verification. Owner discovery screen: map view with garage pins centered on GPS location + list below. Schema adds `googlePlaceId`, `latitude`, `longitude`, `address`, `area`, `district` to Garage. APIs needed: Places Autocomplete, Place Details, Maps SDK (react-native-maps). Google gives $200/month free credit — stays free at startup scale. Requires Google Cloud account with billing card added (but no actual charge within free tier). |

---

## SMB Marketplace — In Development (Parallel Track, started 2026-07-04)

A separate, parallel effort alongside V1 launch prep — not a launch blocker. Full discussion and decisions are recorded in `ROADMAP.md` under "Revised Plan (2026-07-04) — Phase 8 + Phase 12 Merged Into One Parallel Track." Summary:

- **Why now, in parallel:** the pre-launch UI upgrade on `main` is blocked pending Vikum's app name/brand color decision. Marketplace work is new build, not restyling, so it isn't blocked by that and can proceed while the brand decision is pending.
- **Unified scope:** TechVehicle's planned "Vehicle Buying Marketplace" (old Phase 8) and the general SMB marketplace / "ShopSL" (old Phase 12) are being built as **one shared multi-tenant engine**, not two separate efforts — vehicle listings are just "category = vehicles" on the same backend that also powers a standalone SMB app for any small/medium business.
- **Architecture:** a brand new, separate GitHub repo + backend + database from day one (Node.js + Express + Prisma + Neon, same stack as TechVehicle) — never embedded in the TechVehicle codebase. TechVehicle gets a thin-client tab that calls this backend's API; a separate standalone Expo app (the eventual ShopSL product) calls the same backend for the full SMB experience. Login shared by phone number across both apps.
- **Confirmed v1 feature scope:** shop owner sets up company name + logo, then lists products (name, description, price, image). Buyer side has cart, checkout, and order management. Delivery/courier integration and the online payment gateway (3rd-party, e.g. PayHere) are explicitly deferred — v1 checkout is Cash on Delivery only, and orders are handed off to the shop owner to arrange delivery manually.
- **Inspiration:** modeled loosely on Co-op's "Peckish" app (UK) — a white-label platform giving small independent shops their own storefront on a shared backend.
- **Status:** `feature/vehicle-marketplace` branch created off `main` in this repo (not yet pushed); new standalone marketplace repo not yet created — pending a name decision. No code written yet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) |
| Backend | Node.js + Express + Prisma |
| Database | PostgreSQL (Neon) |
| Auth + Push | Firebase |
| Photo Storage | Cloudflare R2 (compressed to ~300 KB per photo) |

## Development Environment

All development runs in GitHub Codespaces — no local install required.

**Start each session:**
```bash
# Terminal 1 — Backend
cd /workspaces/TechVehicle/backend && npm run dev

# Terminal 2 — Mobile
cd /workspaces/TechVehicle/mobile
EXPO_PACKAGER_PROXY_URL=https://<codespace-url>-8081.app.github.dev npx expo start --clear
```

See `CLAUDE.md` for full environment setup, database credentials, and session workflow.
