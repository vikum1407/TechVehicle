# TechVehicle — Project Context & Vision

---

## Current Development State (updated 2026-06-21)

### Completed & Working ✅
- Phone auth (OTP via console in dev, JWT stored in AsyncStorage)
- Add vehicle + My Vehicles screen
- Vehicle Dashboard (blue card, 2×2 quick action grid: Log Fuel, Add Service, Add Expense, Analytics)
- Add Service Record (tap-to-select categories, per-item brands, compact history cards)
- Log Fuel (odometer, litres, cost, km/L insight card)
- Add Expense (tap-to-select categories: Insurance, Revenue Licence, Emission Test, Fine, Parking, Toll, Accessories, Washing, Other)
- Analytics screen (total spend, cost/km, fuel economy, spending by category bars, monthly bar chart, record counts)
- All data persists to Neon (PostgreSQL via Prisma)
- All committed and pushed to GitHub

### Database tables in Neon ✅
`User`, `Vehicle`, `ServiceRecord`, `FuelLog`, `Expense`

### Next Session — Start Here
**Phase 3 — Share & Sell engines.**
First feature: Garage account registration (separate account type, BR number optional, verified/unverified badge). Then the Share flow (owner selects records → sends read-only view to garage → garage submits completed service → owner accepts).

### Known Workflow Note
Write files locally with Claude tools, commit and push from `c:\Vikum\TechVehicle` using git (git IS initialised here). Codespace does `git pull` to get the changes. This is the correct workflow — do NOT use heredocs or Python file-write commands in the Codespace terminal for new files.

---

## Origin Story

The idea came from a real experience: buying a used vehicle whose previous owner had maintained a physical file of all repair bills and maintenance records. That single act of diligence created immediate trust and gave the new owner a clear picture of the vehicle's history. This app is the digital version of that file — done right.

---

## What This App Is

A mobile application (iOS + Android) for vehicle maintenance tracking, expense management, service history sharing, and verified vehicle history transfer at point of sale.

**Core identity:** Mobile-number-based accounts. One person, one account, multiple vehicles. Pricing is tied to the mobile number.

**Product vision:** The most powerful AI-integrated, intelligent vehicle management app on the market. Long-term, the verified data collected by the app becomes the foundation for a trusted in-app vehicle marketplace — where vehicles can be listed and sold with fully verified, tamper-evident service history attached.

**UI/UX principle:** Modern, clean, and highly user-friendly. Every screen should feel intuitive to a non-technical vehicle owner. Card-based layouts, timeline views for history, chart-based analytics, dark/light mode, and quick-action buttons throughout.

---

## Launch Market — Sri Lanka

The first release targets Sri Lanka. All design and data decisions should be grounded in the Sri Lankan context.

| Dimension | Sri Lanka Specifics |
|---|---|
| Vehicle identifier | **Registration number** is primary (e.g. `WP CAB-1234`). VIN is optional/secondary — many older vehicles and Japanese imports don't have an accessible VIN. |
| Common vehicle brands | Toyota, Honda, Nissan, Suzuki, Mitsubishi, Perodua/Daihatsu (very common), Bajaj three-wheelers, TVS/Hero motorcycles |
| Fuel types | Petrol (92 octane, 95 octane), Diesel, Electric (growing) |
| Currency | LKR — Sri Lankan Rupee |
| Language | English (Phase 1), Sinhala (Phase 2 priority — large segment prefers Sinhala) |
| Garage landscape | Many small, informal garages with no Business Registration. BR number field is optional and used only for verified/unverified badge — not a gate. |
| Mileage unit | Kilometres (km) |
| Service interval database | Prioritise models dominant in Sri Lanka: Toyota (Corolla, Prius, KDH van), Honda (Vezel, Fit), Suzuki (Alto, Swift), Mitsubishi (L300, Montero), Bajaj (RE three-wheeler) |

---

## User Roles

| Role | Description |
|---|---|
| Admin | Platform administration |
| Vehicle Owner | Primary user — tracks, shares, sells vehicle history. Can also be a garage owner simultaneously. |
| Garage / Service Center | Separate account type with appointment dashboard. Can own vehicles too. |

---

## Key Features

### 1. Vehicle Maintenance Tracking (Core Engine)

- Log every repair: date, parts replaced, brand of part used, cost, mileage at time of service
- Mileage is the master key — all predictions and recommendations are mileage-anchored
- Full expense tracking including fuel, insurance, registration, and all other vehicle costs
- Photo attachments for receipts and bills (the digital equivalent of the physical file)

### 2. Mileage Engine

This is the most critical input in the entire app. Prediction and analytics accuracy depends entirely on having real, frequent mileage data.

**Input methods (layered approach):**
- **Fuel fill-up logging (primary):** User enters odometer reading each time they refuel — natural trigger, already part of driver habit, low friction
- **Push notification reminder (fallback):** Weekly or configurable reminder to update current mileage if no fill-up was logged
- **Manual entry:** User can update mileage anytime from vehicle profile
- **Future — OBD-II Bluetooth (premium):** ELM327 adapter integration for automatic, near-perfect mileage capture
- **Future — Odometer photo with OCR:** Camera-based reading of the dashboard odometer

**Design principle:** The app should make mileage entry feel like a natural part of the refuel stop, not an extra chore. Show the user immediately what the new mileage unlocks — upcoming service warnings, updated analytics — so they feel the value of entering it.

### 3. Expense Engine

- Track all vehicle-related costs: parts, labour, fuel, insurance, registration, fines, parking
- Categorised, dated, and mileage-stamped
- Feeds the analytics and prediction dashboards
- Enables total cost-of-ownership calculations

### 4. Prediction Engine

The most important intelligence layer. Most vehicle owners damage their vehicles or spend money unnecessarily because they do not know what their vehicle needs and when. This engine saves owners in both knowledge and money.

**What it does:**
- Predicts upcoming service needs based on real mileage data and service history
- Issues notifications when a replacement or service is due or overdue
- Surfaces cost estimates for upcoming services so owners can budget
- Explains *why* a service is needed — educational, not just transactional

**Notification types:**
- "Your engine oil is due in approximately 500 km based on your last change"
- "Your timing belt was last replaced 58,000 km ago — manufacturer recommends replacement at 60,000 km"
- "You haven't logged a brake fluid change. Most manufacturers recommend every 2 years."

**Data sources:**
- Curated database of manufacturer service intervals by make/model/year/region
- Vehicle manual references and manufacturer advisories
- Owner's own historical service records
- Future: community-sourced real-world data from app users

**Phasing:**
- **Phase 1:** Rule-based predictions from a curated interval database
- **Phase 2:** AI/ML layer trained on real accumulated user data across the platform
- Predictions are always surfaced as recommendations, not commands — driving conditions, climate, and actual wear vary per vehicle

**Trust principle:** Every prediction must cite its source (manufacturer recommendation, community data, your own history). The owner must be able to trust the advice enough to act on it and share it with their garage.

### 5. Share Engine

Allows a vehicle owner to share selected service records with a garage or service center before and during a service appointment.

**Sharing rules:**
1. Historical details are NOT shared by default — owner controls exactly what is shared
2. Owner selects specific records (e.g. last 2–3 service entries) — garage sees mileage context and recent part changes
3. Garage/service center receives a read-only view of the selected records
4. After completing the service, the garage fills in a structured form: parts replaced, repairs done, brands used, cost
5. Garage submits the completed service record to the owner
6. Owner receives a push notification and reviews the submission
7. Owner clicks **Accept** — record is saved permanently to vehicle history
8. **No reject/dispute button in the app** — if there is a discrepancy, the owner and garage resolve it in person or by phone. The app is not a dispute platform. The owner simply does not accept until they are satisfied.

### 6. Sell / Transfer Engine

The most differentiated feature of the platform. Verified, tamper-evident history is a trust signal worth real money at resale.

**Flow:**
1. Owner decides to sell the vehicle
2. Owner clicks **Sell** inside the app
3. Owner enters the buyer's mobile number
4. App shows a confirmation summary: vehicle details, total records, date range of history
5. Owner confirms the transfer
6. **All records — service history, expense history, mileage history, photo attachments — are completely removed from the seller's account**
7. The full verified vehicle history is added to the buyer's account
8. Buyer receives a push notification that a vehicle history has been transferred to them
9. Buyer must **Accept** the transfer to complete it
10. Until the buyer accepts, the transfer is pending and the seller cannot re-add the vehicle

**Important:** The sell transfer is irreversible once the buyer accepts. This is by design — it makes the history tamper-evident and trustworthy.

### 7. Garage / Service Center Module

Garages have a separate account type with a different dashboard focused on managing appointments and vehicle service submissions.

**Garage features:**
- Appointment/booking system — vehicle owners can book a service slot
- Per-day capacity management — garage sets how many vehicles they can service per day
- Incoming shared records view — see what the owner has shared before the appointment
- Service submission form — fill in completed work, parts, brands, costs
- Submit to owner for acceptance
- Garage owner can also register personal vehicles under the same account (dual role)

**Garage onboarding:**
- Business Registration (BR) number field — not mandatory but encouraged, used for verification
- Without BR: account is marked as unverified (shown to owners when sharing)
- With BR: account is marked as verified (builds trust with vehicle owners)

**Booking flow:**
1. Vehicle owner searches for a garage by name or location
2. Owner selects available date and time slot
3. Owner can attach a share of their vehicle records to the booking
4. Garage receives the booking and can confirm or suggest a different slot
5. Both parties get push notifications at confirmation and as a reminder before the appointment

### 8. Vehicle Marketplace (Future Engine)

As the user base grows and verified vehicle histories accumulate, the app has a natural foundation for a trusted vehicle marketplace.

**Why this is powerful:**
- Every vehicle listed for sale already has a verified, app-maintained service history
- Buyers can see real mileage, real costs, real parts — not just seller claims
- The sell/transfer function handles ownership handoff natively
- No other marketplace can offer this level of verified history by default

**Planned features:**
- List a vehicle for sale with history attached
- Buyer browses with full confidence in the data
- Price suggestions based on vehicle history, mileage, and market data
- In-app transfer of ownership and history on sale completion

---

## Vehicle Identity

- **Registration number** is the primary identifier (e.g. `WP CAB-1234`) — this is what Sri Lankan owners know and use daily
- **VIN** is a secondary optional field — recorded if available for extra verification
- One vehicle = one registration number = one active owner at any time
- If a user attempts to add a registration number already in the system: app shows a message directing them to contact support
- Support resolves genuine disputes (lost phones, incorrect transfers, previous owner who never sold in-app)

---

## Historical Data Entry (Onboarding Wizard)

A new user with an existing vehicle must be able to enter years of history comfortably without feeling overwhelmed. The wrong approach is an empty form asking for everything at once. The right approach is a guided, progressive wizard that collects the most valuable data first and lets the user fill in the rest gradually.

### Wizard Flow

**Step 1 — Vehicle Setup (required, 1–2 minutes)**
- Registration number (primary identifier)
- Make, model, year
- Fuel type
- Current odometer reading (today's mileage — the starting point for all future predictions)
- Vehicle photo (optional but encouraged)
- VIN (optional)

**Step 2 — Major Milestones (guided, skip-friendly)**
The app asks for the most prediction-critical service history first, in plain language:
- "When did you last change your engine oil? (approximate date and mileage is fine)"
- "Has your timing belt / cam belt been replaced? If yes, when and at what mileage?"
- "When were your brake pads last replaced?"
- "Has your battery been replaced? If yes, approximately when?"

Each question has a **"Not sure / Skip"** option — partial data is better than no data.

**Step 3 — Full History Entry (optional, ongoing)**
- After the wizard, the user lands on the History screen with a prominent **"Add past record"** button
- Historical records use a simplified entry form: date (approximate is fine), what was done, cost (optional), mileage (optional)
- Mileage can be marked as **"Estimated"** — the prediction engine will flag estimated vs. confirmed mileage data
- User can photograph old receipts from their gallery and attach them to historical records
- Future: OCR on receipt photos to auto-fill fields

### Design Principles for History Entry
- Never block progress — every field except the record description is optional for historical entries
- Show a progress indicator: "Your vehicle profile is 60% complete — add 2 more records to unlock full predictions"
- Gamify completion gently: completing the wizard unlocks the prediction dashboard
- "Quick Add" mode for historical entries: single-screen, minimal fields
- "Detailed Add" mode for new current entries: full form with all fields

---

## Photo Attachments & Storage

**Decision:** Photos are stored in **cloud storage (compressed)** — not only on the device local library.

**Why cloud storage is required:**
- Photos must transfer completely during the **Sell** function — if stored only on the seller's phone, the new owner gets no photos
- Photos must be viewable during **Share** with a garage — local-only photos cannot be shared
- Phone loss or replacement would destroy all history photos if stored locally only

**Storage strategy to keep costs low:**
- Compress all uploaded photos to 200–400 KB on upload
- Option for user to also save a copy to their phone's photo library (their choice)
- Per-user storage stays small due to compression — a vehicle with 10 years of records might use 20–50 MB
- Future: offer storage tier limits as part of the pricing model

---

## Architecture Philosophy

Each major feature is a **separate engine** with its own data model and update cadence. They are loosely coupled so they can be shipped, updated, and scaled independently.

```
┌──────────────────────────────────────────────────────────────┐
│                   Mobile App (React Native / Expo)            │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Vehicle  │ Mileage  │ Expense  │ Service  │ Share / Transfer  │
│ Profile  │ Engine   │ Engine   │ Engine   │ Engine           │
│ Engine   │          │          │          │                  │
├──────────┴──────────┴──────────┴──────────┴──────────────────┤
│                  Prediction & AI Engine (backend)             │
├──────────────────────────────────────────────────────────────┤
│            Notification Engine (push + scheduling)            │
├──────────────────────────────────────────────────────────────┤
│         Garage / Booking Engine (separate dashboard)          │
├──────────────────────────────────────────────────────────────┤
│              Vehicle Marketplace Engine (future)              │
└──────────────────────────────────────────────────────────────┘
```

---

## AI Integration Vision

TechVehicle is not just a logging app — it is an intelligent vehicle companion. AI integration points:

- **Prediction Engine:** AI-powered service forecasting based on real data
- **Cost Forecasting:** Predict upcoming expenses for the next 6/12 months
- **Anomaly Detection:** Flag if a part was replaced unusually frequently (possible quality issue or incorrect install)
- **Personalised Insights:** "Your vehicle uses more fuel than average for its model — possible causes include..."
- **Natural Language Q&A:** "When did I last change my brake pads?" answered from vehicle history
- **Marketplace Valuation:** AI-estimated price based on verified history, mileage, and market comparables

---

## Special Analytics Data Points

These are structured data fields captured inside service records that feed the prediction and AI engines. They are not just text — they are specific, queryable data points that unlock deeper intelligence. Every screen that touches these must treat them as first-class structured data, not free text.

### 1. Tyre Change & Wheel Alignment Ratio

**What it is:** The interval in km between tyre changes and the frequency of wheel alignments between each tyre set.

**Why it matters:**
- Km per tyre set = real tyre consumption rate for this vehicle and this owner
- Alignment frequency between tyre changes = tells the story of driving conditions (rough roads = more alignments)
- Ratio of alignments to tyre sets = proxy for how aggressive the roads or driving style are
- If a vehicle gets 5 alignments per tyre set, it is either on very bad roads or has a suspension problem

**What to capture (structured):**
- When "Tyre Change" is logged: tyre brand, tyre size (e.g. 185/65R15), km at change
- When "Wheel Alignment" is logged: km at alignment
- Analytics engine derives: km-per-tyre-set, alignments-per-tyre-set, trend over time

**Future insight example:** "Your tyres lasted 35,000 km — 18% less than average for your model. You also had 4 alignments this set. Possible cause: road conditions or suspension wear."

---

### 2. Oil Grade vs Manufacturer Recommendation

**What it is:** The actual engine oil brand AND grade (viscosity spec) used at each oil change, compared against what the vehicle manufacturer recommends for the model and climate.

**Why it matters:**
- Using the wrong grade is one of the most common causes of premature engine wear
- Many Sri Lankan owners use whatever oil the garage recommends, which may not match the manufacturer spec
- Over time, consistent use of wrong-grade oil shows up as increased oil consumption, poor fuel economy, and engine damage
- The app can flag this proactively: "Your last 3 oil changes used 20W-50. Toyota recommends 0W-20 for your Prius."

**What to capture (structured):**
- Oil brand (e.g. Castrol)
- Oil grade / viscosity spec (e.g. 10W-40, 5W-30, 0W-20, 20W-50)
- Oil type (Mineral / Semi-synthetic / Full synthetic)
- Km at change and km since last change (oil change interval)

**Data source needed:** Manufacturer-recommended oil spec database per make/model/year — this feeds the comparison engine.

**Future insight example:** "You changed your oil every 4,200 km on average. Your manufacturer recommends 5,000 km. You could save LKR 18,000/year by extending your interval."

---

### 3. Emission / Carbon Test Results

**What it is:** The numerical results from a vehicle emission test (carbon test). In Sri Lanka, this is required annually for the revenue licence (registration renewal). The readings include CO%, HC ppm, CO2%, and Lambda (air-fuel ratio).

**Why it matters:**
- These numbers are a direct window into engine health and combustion efficiency
- Rising HC (hydrocarbons) = engine burning oil or misfiring
- Rising CO (carbon monoxide) = rich fuel mixture, injector issues, or catalytic converter failure
- Poor Lambda (air-fuel ratio off from 1.0) = fuel system problems
- Trend over time = early warning of deteriorating engine health before expensive failure
- Driving style correlation: high-mileage highway drivers vs city drivers show different emission profiles

**What to capture (structured):**
- Test date and km at test
- CO% (carbon monoxide percentage)
- HC ppm (hydrocarbon parts per million)
- CO2% (carbon dioxide percentage)
- Lambda / Air-fuel ratio (if available)
- Test result: Pass / Fail
- Testing station name (optional)

**Future insight example:** "Your HC reading has increased from 85 ppm (2023) to 210 ppm (2024). This may indicate early oil burning. Consider a compression test at your next service."

---

### 4. AC System Condition & Fuel Consumption

**What it is:** The AC system is one of the largest fuel consumers in a vehicle — typically adding 10–20% to fuel consumption when running. Tracking AC service history, refrigerant type, and component condition over time gives a direct window into one hidden driver of fuel costs.

**Why it matters:**
- A leaking AC system that loses refrigerant gradually makes the compressor work harder, burning more fuel
- A failing AC compressor can increase engine load significantly
- AC gas type (R134a vs R1234yf) matters for environmental compliance and refill cost
- Frequency of AC gas refills tells the story of refrigerant leaks — too frequent = compressor or seal problem
- Dirty cabin filters and AC filters reduce airflow, increasing compressor load
- Comparing fuel cost before/after AC compressor replacement or gas refill can confirm the impact

**What to capture (structured):**
- AC Gas Refill: refrigerant type (R134a / R1234yf / R22), quantity filled (grams), km at refill
- AC Compressor: brand, km at replacement
- AC Service: what was done, km at service
- Cabin / AC Filter: brand, km at replacement

**Future insight example:** "You've refilled AC gas 3 times in 18 months — average refrigerant loss suggests a seal or compressor issue. A leak test at your next service could save LKR 15,000/year in fuel."

**Cross-analysis with fuel logs:** Once fuel fill-up logging is active, the app can correlate AC service events with fuel consumption changes — showing owners exactly what impact AC repairs had on their running costs.

---

### Implementation Note

These three data points require **dedicated structured input fields** when the relevant service type is selected — not just a notes field. The service record form should detect when "Tyre Change", "Wheel Alignment", "Oil Change", or "Emission Test / Carbon Test" is selected and show the appropriate structured sub-form automatically.

The `ServiceRecord` database model will need a `structuredData` JSON field to store these values in a queryable format alongside the free-text description.

---

## Recommended Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile | React Native (Expo) | Single codebase for iOS + Android |
| Backend | Node.js + PostgreSQL (Neon) | Relational data suits vehicle history well |
| Auth + Push | Firebase | Native phone number auth, push notifications |
| Photo Storage | S3 or Firebase Storage (compressed) | Must be cloud for Sell/Share to work |
| AI / ML | To be decided in Phase 2 | Python-based ML service or third-party AI API |

---

## Pricing Model

- **Mobile-number-based** — one subscription per person, covers all their vehicles
- **Launch strategy:** Full feature access for free for the first 3–4 months after launch — build the user base and collect real data before monetising
- **Pricing tiers (post-launch):**
  - **Free:** 1 vehicle, basic history logging, manual mileage entry
  - **Paid:** Multiple vehicles, analytics dashboard, prediction engine, garage booking, share/sell features, photo storage

---

## UI / UX Standards

- **Style:** Modern, clean, card-based layouts. No cluttered screens.
- **Navigation:** Bottom tab bar for main sections (Home, My Vehicles, History, Analytics, Garage)
- **Vehicle home screen:** Vehicle photo at top, current mileage, next service due (prominent), quick-action buttons (Add Record, Share, Log Fuel)
- **History view:** Timeline/chronological list — most recent at top, each record as a card with date, mileage, summary, and expand for detail
- **Analytics:** Chart-based — expense breakdown (pie/bar), mileage trend (line), upcoming costs forecast
- **Onboarding:** Wizard-style, step-by-step, skip-friendly
- **Theme:** Dark mode and light mode supported
- **Language:** English (Phase 1), Sinhala (Phase 2)
- **Accessibility:** Large tap targets, readable font sizes — many vehicle owners will use the app in bright sunlight or while hands are dirty

---

## Confirmed Design Decisions

| Decision | Resolution |
|---|---|
| Sell transfer | All records fully removed from seller, fully added to buyer |
| Reject/dispute button | Not included — disputes resolved in person between owner and garage |
| Photo storage | Cloud (compressed to 200–400 KB), with optional copy to device library |
| Garage BR number | Collected but not mandatory; used to show verified/unverified badge |
| Garage dual role | Garage owners can also register and manage personal vehicles |
| Offline behaviour | App queues writes locally and syncs when connectivity returns |
| Launch pricing | Free for all features for 3–4 months, then tiered pricing |
| Vehicle identity | Registration number (primary), VIN (optional secondary) |
| Launch market | Sri Lanka — all data, currency, language, vehicle models calibrated accordingly |
| Historical entry | Progressive onboarding wizard; Quick Add mode for old records; mileage can be marked Estimated |
| Mileage unit | Kilometres (km) |
| Currency | LKR (Sri Lankan Rupee) |

---

## How We Are Building This

- **Solo developer:** Vikum, working session by session with Claude
- **Approach:** Claude writes and explains the code, Vikum reviews, runs it, and directs what comes next
- **Experience level:** Some programming experience — explanations cover the *why* behind decisions, not absolute basics
- **Rhythm:** Each session picks up where the last left off. The CLAUDE.md file is the shared memory across every session.
- **Development method:** Feature by feature, end-to-end. Each feature is 100% complete (backend + mobile UI) before the next starts. This catches design mistakes early.

---

## Development Environment — 100% Cloud (No Local Install Required)

Current machine has limited space and performance. Entire development runs in the cloud. Only a browser and a phone are needed.

### Cloud Services Used for Development

| Service | Purpose | Free Tier | Cost Beyond Free |
|---|---|---|---|
| **GitHub Codespaces** | Code editor + terminal in browser (VS Code) | 60 hrs/month | $4/month (Pro) for 180 hrs |
| **Neon** | PostgreSQL database | 0.5 GB, never pauses, serverless | $19/month (Pro) |
| **Firebase** | Phone number auth + push notifications | 10,000 SMS/month, unlimited push | Pay-as-you-go, very low cost |
| **Cloudflare R2** | Photo/file storage | 10 GB/month, zero download fees | ~$0.015/GB beyond free |
| **Expo Go** (phone app) | Live mobile preview during development | Free, unlimited | Free |
| **GitHub** | Code repository | Free, unlimited private repos | Free |

**Total development cost: $0/month** on free tiers. Only upgrade when real users arrive.

### What Runs Where

```
Your Browser (Codespace)          Your Phone (Expo Go)
─────────────────────────         ────────────────────
VS Code editor                    Live preview of mobile app
Node.js backend server            Updates instantly on save
PostgreSQL via Neon ──────────────────────────────────────►  See changes in real time
Firebase auth
Cloudflare R2 storage
```

### Accounts to Create Before Starting (All Free)

1. **github.com** — GitHub account (Codespaces + code storage)
2. **expo.dev** — Expo account (mobile build and preview)
3. **supabase.com** — Supabase account (database)
4. **firebase.google.com** — Firebase account (phone auth + push)
5. **cloudflare.com** — Cloudflare account (photo storage)

### On Your Phone
Install **Expo Go** from the App Store or Google Play. This is how the mobile app appears on your phone during development — no app store submission needed.

### When New Laptop Arrives
Zero migration needed. Clone the GitHub repository, open Codespace, continue. Nothing is stored locally.

### How to Start the Dev Environment Each Session

**Terminal 1 — Backend:**
```bash
cd /workspaces/TechVehicle/backend
npm run dev
```

**Terminal 2 — Mobile:**
```bash
cd /workspaces/TechVehicle/mobile
EXPO_PACKAGER_PROXY_URL=https://fantastic-space-parakeet-9j477gpjj4qfxvw7-8081.app.github.dev npx expo start --clear
```

**Expo Go on phone:** Enter URL manually → `exp://fantastic-space-parakeet-9j477gpjj4qfxvw7-8081.app.github.dev`

> Note: If the Codespace is recreated, the URL prefix (`fantastic-space-parakeet-9j477gpjj4qfxvw7`) will change. Get the new URL from the PORTS tab in VS Code.

---

## Development Phases

Each feature is built end-to-end (backend API + mobile screen) before moving to the next. This catches data model mistakes early and keeps the app always in a working state.

### Phase 0 — Project Foundation `~2 weeks`
*No user-facing features. Just the skeleton everything plugs into.*
- GitHub repository created (monorepo structure)
- GitHub Codespace configured and working
- React Native + Expo project initialised
- Node.js + Express backend initialised
- Supabase database connected
- Firebase phone auth wired end-to-end (real SMS login working)
- Cloudflare R2 storage bucket configured
- Basic CI/CD: backend auto-deploys on push to main

**Milestone: Can log in with a real Sri Lankan mobile number and see a blank app on your phone.**

### Phase 1 — MVP Core `~6–8 weeks`
*Everything a single vehicle owner needs to use the app daily.*

| Feature | Backend | Mobile Screen |
|---|---|---|
| Phone auth | Firebase integration | Login screen |
| Add vehicle | `vehicles` table + API | Add Vehicle wizard (Step 1 + 2) |
| Vehicle dashboard | Vehicle detail API | Dashboard (photo, mileage, next service card) |
| Add service record | `service_records` table + API | Add Record form |
| History timeline | Records list API | History screen (chronological cards) |
| Fuel fill-up / mileage update | `mileage_logs` table + API | Log Fuel screen |
| Receipt photo upload | Cloudflare R2 integration | Camera/gallery picker in Add Record |
| Offline sync | Local queue + sync logic | Transparent to user |

**Milestone: A real vehicle owner can add their vehicle, enter history, and log a new service. Test with your own vehicle.**

### Phase 2 — Expense & Analytics `~4–5 weeks`

| Feature | Backend | Mobile Screen |
|---|---|---|
| Expense entry | `expenses` table + API | Add Expense form (categorised) |
| Expense analytics | Aggregation queries | Analytics dashboard (pie, bar, line charts) |
| Cost per km | Calculation engine | Analytics card |
| PDF history export | PDF generation | Export button on History screen |

**Milestone: Owner can see full financial picture of their vehicle.**

### Phase 3 — Share & Sell `~6–8 weeks`

| Feature | Backend | Mobile Screen |
|---|---|---|
| Garage account | `garages` table + API | Garage registration screen |
| Garage BR verification | Verified flag logic | Verified badge on garage profile |
| Share session | `share_sessions` table + API | Select Records → Share screen |
| Garage service submission | Submission form API | Garage: view shared + submit form |
| Owner accept flow | Accept endpoint + notification | Owner: notification + Accept screen |
| Sell / transfer | Transfer transaction API | Sell screen → confirm → buyer notification |
| Multiple vehicles | Multi-vehicle query support | My Vehicles screen |

**Milestone: Can share history with a garage and complete a full vehicle sale transfer.**

### Phase 4 — Garage Booking `~4–5 weeks`

| Feature | Backend | Mobile Screen |
|---|---|---|
| Garage availability | `availability` table + API | Garage: set schedule screen |
| Booking creation | `bookings` table + API | Owner: Book Appointment screen |
| Booking confirmation | Notification + confirm API | Garage: Booking dashboard |
| Appointment reminders | Scheduled notifications | Push to both owner and garage |

**Milestone: Vehicle owner can discover and book a garage appointment through the app.**

### Phase 5 — Prediction Engine `~8–10 weeks`

| Feature | Backend | Mobile Screen |
|---|---|---|
| Service interval database | Curated data: Toyota, Honda, Suzuki, Mitsubishi, Bajaj | — |
| Prediction rules engine | Per-vehicle due-date calculator | Prediction dashboard |
| Service due notifications | Scheduled push notifications | Push alert: "Oil due in 500 km" |
| Overdue alerts | Escalation logic | Push alert: "Timing belt overdue" |

**Milestone: App proactively tells owners what service is coming up, with source cited.**

### Phase 6 — AI & Marketplace `Future`
- AI/ML prediction layer trained on real platform data
- Natural language vehicle history Q&A
- Anomaly detection and cost forecasting
- Vehicle marketplace with verified history listings
- OBD-II Bluetooth integration (premium tier)

---

## Risks to Watch

1. **Mileage data quality** — The prediction engine is only as good as the mileage data. Make mileage entry frictionless and immediately rewarding. This is the most important UX problem to solve.
2. **Garage adoption** — Share and booking features only work if garages use the platform. Plan a garage onboarding campaign alongside the owner launch.
3. **Photo storage costs** — Compress aggressively at upload. Set per-user storage limits in the pricing tiers before costs scale.
4. **VIN database** — Not all vehicles (especially older or non-standard ones) have valid VINs. Plan for an alternative identifier for edge cases.
5. **Prediction data source** — The curated service interval database is a significant data problem. This must be sourced or built before Phase 3 predictions have any credibility.
6. **Data privacy** — Vehicle history, expense patterns, and location data is sensitive. Define data retention, deletion, and export policies before launch.
