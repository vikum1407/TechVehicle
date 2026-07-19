# TechVehicle

Intelligent vehicle maintenance tracking, expense management, service history sharing, and verified vehicle history transfer — built for Sri Lanka.

---

## Development Progress

Last updated: 2026-07-16

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

## UI Upgrade — Phases A–D (started 2026-07-04)

Pre-launch visual polish pass, prioritized over the paused SMB Marketplace work (see below) since it's the last thing blocking V1 release. Brand decided 2026-07-04: **navy `#1d3a5f` + amber `#e3a008` accent**, replacing the placeholder Google Blue used everywhere. Workflow per phase: build on a temporary `ui-phase-x` branch → push → test live in Codespace/Expo Go → merge to `main` → delete the branch. Design mockups reviewed as HTML artifacts before implementation on the bigger phases (B, C).

- **Phase A — Brand & Typography — DONE, merged to `main`.** Navy+amber applied app-wide via `theme/colors.ts` (new `accent`/`accentTint` tokens added); new `theme/typography.ts` scale defined (heading/subhead/body/caption/numeric); ~25 hardcoded blue hex literals fixed across screens, charts, PDF export, and `app.json` (splash/icon/notification colors — those need a native rebuild to actually show); 3 `fontWeight: 'bold'` → `'700'` normalized.
- **Phase B — Dashboard Redesign — DONE, merged to `main`.** Vehicle card trimmed to photo/name/mileage + the 4 core quick actions (Log Fuel highlighted in amber, since frequent mileage logging is what the whole Prediction Engine depends on); secondary actions (Vehicle Tests, Know Your Vehicle, Cost Forecast, Book Service, Chain Service, Daily Trip Log) moved into a "•••" bottom-sheet menu next to the notification bell — modeled on a hamburger-menu idea but using "•••" instead since these are vehicle-scoped, not app-wide, actions. Family/Shared Access and Sell/Transfer Vehicle also moved into that same menu (rare or one-time actions, not routine dashboard content). Vehicle Profile progress-% card and owners/reg-no stats card merged into one. Mileage/Fuel Economy sparklines moved higher up the scroll (were buried below Predictions/Appointments). Mileage "Update" link now has a pulsing amber border so it reads clearly as tappable.
- **Phase C — Navigation Polish — DONE, merged to `main`.** All ~20 screens' independently-styled headers (two competing families: bare-link-plus-big-title vs. boxed-header-with-drift) unified into one shared `components/ScreenHeader.tsx`. Fixed real bugs found along the way: TripLogScreen's hardcoded orange back button, missing bold weight on 2 screens' back links. Root-tab screens (My Vehicles, Garage) and auth/entry screens keep their own headers by design (no back button needed). Confirmed the phone's hardware/gesture back button was already centrally handled via `App.tsx`'s `BackHandler` map.
- **Phase D — Forms Polish — DONE, merged to `main`.** New shared `components/FormField.tsx` (labeled input), `Button.tsx` (primary/secondary/destructive with built-in loading state), `Chip.tsx` (solid-fill tap-to-select) — 12 forms migrated onto them (Add Service, Add Expense, Add Vehicle, Log Fuel, Trip Log, Log Emission Test, Notification Prefs, Booking, Share, Sell, Vehicle Tests, Garage). Standardized on solid-fill selected chips and plain sentence-case field labels (previously two competing styles existed across the app). Fixed real bugs: TripLogScreen's orange Save button, GarageScreen's green Submit buttons, 2 screens' Save buttons showing no dimming when disabled/loading, SellScreen's outlier phone input (colored border, oversized font, no visible label), and numerous hardcoded hex colors that didn't match any actual theme token.

**V1 UI upgrade is now feature-complete (all 4 phases merged).** Live testing of Phase D also caught several bugs unrelated to forms polish itself, all fixed in the same pass:
- Merged Vehicle Profile card (Phase B) had no bottom margin, so on a vehicle with little history it sat flush against the next card with zero gap.
- Daily Trip Log had no `KeyboardAvoidingView` (keyboard covered inputs) and no real-time validation feedback on End Odometer vs Start Odometer (only caught on Save).
- Daily Trip Log was missing from `App.tsx`'s hardware-back map — the phone's physical/gesture back button did nothing on that screen.
- GarageScreen's "Suggest Slot" counter-offer dialog crashed — `<Modal>` was used but never imported. Pre-existing bug, unrelated to any UI phase.
- **Bell notification count wasn't refreshing on in-app tab switches** — only refreshed on login and OS-level app-foreground events. Invisible in normal two-party use, but fully exposed for a dual-role garage owner servicing their own vehicle (one continuous session, just switching Vehicles/Garage tabs) — notifications were being created correctly in the database the whole time, the bell just never re-polled. Now refreshes on every tab press. Also fixed an adjacent bug where rejecting a submission mislabeled its notification type as "accepted."

---

## iOS Device Testing (2026-07-17) — for future test automation

First-ever real iOS device testing, done after all 4 UI Upgrade phases above were merged to `main` (prior testing had been Android-only). Device: iPhone 6s, iOS ~15, tested live via Expo Go. All fixes below are on branch **`ios-safe-area-fix`**, to be merged to `main` once this checklist fully passes.

**Test method:** Codespace backend (`npm run dev`) + Metro bundler (`npx expo start --clear`) with `EXPO_PACKAGER_PROXY_URL` set to the Codespace's forwarded port URL. On iOS, typing the URL directly into Expo Go did not reliably connect — the working method was scanning the Metro QR code with the iPhone's native **Camera** app, then tapping the resulting notification to open in Expo Go.

**Areas covered, all confirmed passing after fixes:**
- **Safe-area / notch handling** — every screen header, the bottom tab bar, the full-screen photo viewer modal, and the Add Vehicle brand/model picker modal all sit correctly below the notch/status bar and above the home indicator. Fixed by adding `react-native-safe-area-context` (`useSafeAreaInsets`) app-wide, replacing hardcoded header padding.
- **Keyboard covering input fields** — ~14 screens needed `KeyboardAvoidingView` added (Add Service, Add Expense, Add Vehicle, Log Fuel, Trip Log, Booking (all 4 steps), Garage forms, Vehicle Tests, Knowledge Hub, My Vehicles search, Vehicle Dashboard modals, Sell/Transfer, Share flow, Predictions). Trip Log also gained inline red validation (End Odometer < Start Odometer) instead of only catching it on Save, plus a fix for the physical/gesture back button not working on that screen.
- **Vehicle Dashboard — "My Appointments" message box hidden behind keyboard** (found 2026-07-18, after the rest of the checklist had already passed): the dashboard's main scrollable body was the one screen still missing `KeyboardAvoidingView` — appointment cards (and their message threads) can appear anywhere in that scroll, not just near the top, so the reply input was covered whenever the keyboard opened. Fixed by wrapping the full dashboard body the same way as every other screen.
- **Role Select screen (new-user flow)** — "← Use a different number" link added (previously a dead end: no way back to the phone-login screen even after a server restart, since the JWT persists in SecureStore); fixed card-overlap when a role card grows taller to show "✓ Selected".
- **Dark mode contrast** — fixed invisible dark-on-dark typed text in the Garage booking chat/message thread, and unreadable booking status badges (Pending/Confirmed/Counter Sent) on the garage side. **Known deferred item:** the same "light pastel background + theme-shifting text" contrast bug is confirmed to also exist in ~11 other files (Analytics, Booking, Cost Forecast, Log Fuel, Predictions, Sell, Share, Trip Log, Vehicle Dashboard, Vehicle History, Vehicle Tests) — flagged for a dedicated dark-mode audit later, not fixed piecemeal this round.
- **Placeholder letter-spacing bug (iOS-only)** — old-iOS quirk where unset `letterSpacing` renders placeholder text on `TextInput`s with visible gaps between letters. Root-caused and fixed via explicit `letterSpacing: 0`, first on the shared `FormField` component, then individually on every raw (non-`FormField`) `TextInput` confirmed still affected: My Vehicles search, Knowledge Hub search, Booking search/notes, Predictions setup/override fields, Garage's note/summary/brand fields.
- **Incidental bugs also found and fixed during this pass:** Garage's "Suggest Slot" counter-offer dialog crash (missing `Modal` import); bell notification unread count not refreshing on in-app tab switches (only refreshed on login/app-foreground — exposed by the dual-role garage-servicing-own-vehicle scenario); a rejected service submission mislabeling its notification type as "accepted."

**Open question not yet resolved:** the iPhone 6s is a 2015 device capped at iOS 15 — worth deciding how much further old-iOS-specific effort (e.g. the letter-spacing quirk) is warranted once real user device-age data exists, versus treating this device as a lower-priority compatibility floor.

---

## SMB Marketplace — Planned, Currently Paused (discussed 2026-07-04)

Priority was reconfirmed 2026-07-04: finish V1 (including the UI Upgrade above) **before** starting marketplace work — this is no longer a parallel track, it's next in line once Phase D above is tested and merged. Full discussion and decisions are recorded in `ROADMAP.md` under "Revised Plan (2026-07-04) — Phase 8 + Phase 12 Merged Into One Parallel Track." Summary of the plan for when it resumes:
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

---

## Continuous Testing Deployment (planned 2026-07-19) — $0/month

The Codespace/Metro-tunnel workflow above is for **active development**. It doesn't work for ongoing testing since it requires the Codespace to be running. This section is the $0-cost plan to let testers use the app anywhere, anytime, without a laptop.

**Two independent pieces:**
1. **Backend → Render free web service.** Always reachable at a stable URL (sleeps after 15 min idle, ~30–50s cold start on the first request after that — acceptable for a testing phase, not production). Blueprint at `backend/render.yaml` (rootDir `backend`, build `npm install && npm run build`, start `npm start`, health check `/health`). Secrets (`JWT_SECRET`, `DATABASE_URL`, R2 keys) are entered directly in the Render dashboard, not committed. Database stays on Neon (no change) — same instance the Codespace already uses.
   - *Known limitation:* the daily cron jobs (renewal reminders, service-due predictions, mileage nudges, booking reminders — see `backend/src/jobs/`) run in-process and only fire while the service is awake. On the free tier they may get skipped if the app is asleep at the scheduled time. Fine for testing; would need an external ping/cron (e.g. a free UptimeRobot check hitting `/health`) or a paid always-on tier before real launch.
   - *(A `backend/railway.json` existed from an earlier, since-abandoned attempt to use Railway — removed 2026-07-19 since Railway no longer has a free tier.)*
2. **Mobile → EAS Update, opened in Expo Go.** Instead of Codespace's Metro bundler + tunnel URL, publish the JS bundle to Expo's free EAS Update CDN (`eas update --branch preview`) and open it via the persistent project link/QR from `expo.dev` — testers scan it once in Expo Go and get the current published version any time, no dev server needed. Requires adding the `expo-updates` package (not yet installed) and running `eas init` once to get a real EAS project ID (`app.json`'s `extra.eas.projectId` is still the placeholder `YOUR_EAS_PROJECT_ID`). Every time mobile code changes, one `eas update` command re-publishes; testers just reopen the same link.

**Status:** config scaffolding done (`backend/render.yaml` added, `mobile/eas.json`'s stale Railway placeholder URLs replaced with a Render placeholder). Not yet deployed — remaining steps need a Render account + dashboard setup, an `eas init`/`eas update` run, and installing `expo-updates`, all done from the Codespace/browser.
