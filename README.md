# TechVehicle

Intelligent vehicle maintenance tracking, expense management, service history sharing, and verified vehicle history transfer — built for Sri Lanka.

---

## Development Progress

Last updated: 2026-06-29

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
- Vehicle Tests Screen — Emission tab, Wheel Alignment tab, Chain Service tab (each: pinned status card + history list)
- Log Emission Test — dedicated quick-action button on dashboard
- Three-Wheeler Daily Trip Log — start/end odometer, fuel, earnings, cost-per-km and profit
- Vehicle Profile Card — purchase date, owner count, vehicle notes (editable)
- Role Selection — Vehicle Owner or Garage/Service Center on first login

---

## Remaining Tasks

### High Priority — Next to Build

| Task | Description |
|---|---|
| **Insurance tab in VehicleTestsScreen** | 4th tab: pinned current policy card (company, policy no, expiry, status colour) + Insurance expense history below |
| **Revenue Licence tab in VehicleTestsScreen** | Same pattern — pinned current RL expiry card + expense history. Completes the legal documents set |
| **Emission Test expiry edit in modal** | Currently set only via Log Emission Test screen — should also be editable in Edit Vehicle modal for consistency |

### Medium Priority

| Task | Description |
|---|---|
| **Onboarding Wizard** | Step-by-step wizard for new users: vehicle setup → major milestones (last oil, timing belt, brake pads) → lands on dashboard |
| **Vehicle profile completion score** | Backend `/progress` endpoint already built. Show the score bar on dashboard to nudge users to fill in gaps |
| **Mileage reminder push** | Weekly nudge if no fuel log in 7 days — backend job skeleton exists, needs wiring |
| **Cost Forecast screen** | Backend `/predictions/:id/cost-forecast` already built. Mobile screen showing upcoming 12-month estimated spend |

### Lower Priority / Future

| Task | Description |
|---|---|
| **PDF branding** | Logo + brand colour needed before redesign — deferred pending design decision |
| **Sinhala language** | Phase 2 — large segment of Sri Lankan market |
| **OBD-II Bluetooth** | Premium tier — ELM327 adapter for automatic mileage capture |
| **Vehicle Marketplace** | Phase 6 — list vehicles for sale with verified history attached |
| **AI natural language Q&A** | "When did I last change my brake pads?" answered from history |
| **Garage discovery / map** | Search garages by location, not just by name |

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
