# Vocksy Mart — Existing Codebase Reference

Compiled 2026-10-04 by direct code inspection (file paths/line numbers as of that date) to ground the Vocksy Mart spec in real facts, not assumptions. Source: `C:\Vikum\TechVehicle`.

---

## A. Stack and structure

**Backend:** Express `^5.2.1`, TypeScript `^6.0.3` (ts-node/nodemon in dev, `tsc` for prod), PostgreSQL via Prisma `@prisma/client ^6.0.0`. No Node `engines` pin. No test script exists.

`backend/src/` layout:
- `routes/` — 18 files, one per resource (`auth.ts`, `vehicles.ts`, `garages.ts`, `bookings.ts`, `serviceSubmissions.ts`, `uploads.ts`, `notifications.ts`, etc.)
- `middleware/` — `auth.ts` (JWT), `globalRateLimit.ts`
- `utils/` — `phone.ts`, `validate.ts`, `rateLimit.ts`, `otpRateLimit.ts`, `jwtSecret.ts`, `appNotifications.ts`, `push.ts`, `predictionEngine.ts`, `garageSlots.ts`, `vehicleAccess.ts`
- `jobs/` — cron-style: `bookingReminders.ts`, `mileageReminders.ts`, `renewalReminders.ts`, `serviceNotifications.ts`
- `data/` — static datasets: `serviceCatalog.ts`, `serviceIntervals.ts`, `vehicleKnowledge.ts`
- No `helpers/` directory — only `utils/`.

**Mobile:** Expo `~54.0.37`, React Native `0.81.5`, React `19.1.0`. **No navigation library.** Manual screen-state switching: `App.tsx:40-45` `Screen` union type, `App.tsx:78` `useState<Screen>('loading')`, JSX body is `{screen === 'x' && <XScreen/>}` blocks. Manual Android back-handler via a `backMap` object (`App.tsx:277-312`). No state library — plain `useState`/Context (`ThemeContext.tsx`, `LanguageContext.tsx`).

Bottom tabs (`mobile/src/components/BottomTabBar.tsx`, `App.tsx:72`): only **"My Vehicles"** and **"Garage"** today (garage tab conditional on `hasGarage`). A third "Mart" tab would be added here.

26 screens in `mobile/src/screens/`: AddExpenseScreen, AddServiceRecordScreen, AddVehicleScreen, AnalyticsScreen, BookingScreen, CostForecastScreen, EmailSetupScreen, GarageLedgerScreen, GarageScreen, HomeScreen *(unused — not imported anywhere)*, KnowledgeHubScreen, LogEmissionTestScreen, LogFuelScreen, LoginScreen, MyVehiclesScreen, NotificationPrefsScreen, NotificationsScreen, OTPScreen, OnboardingWizardScreen, PredictionsScreen, ProfileScreen, RoleSelectScreen, SellScreen, SettingsScreen, ShareScreen, TripLogScreen, VehicleDashboardScreen, VehicleHistoryScreen, VehicleTestsScreen.

**API client** (`mobile/src/config/api.ts:25-30`):
```ts
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
const authHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})
```
Every one of ~90 `api.*` functions: `fetch → res.json() → if (!res.ok) throw new Error(data.error || fallback) → return data`.

---

## B. Auth and users

**Login flow:** Phone OTP (6-digit, `crypto.randomInt`), stored in an **in-memory Map** (`otpStore`), 5-min expiry. No SMS provider — OTP only reaches `console.log` (documented limitation, not yet fixed). On verify: JWT signed `{ phoneNumber, tokenVersion }`, **30-day expiry**, HS256.

```ts
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorised — no token provided' }); return
  }
  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { phoneNumber: string; tokenVersion?: number }
    const user = await prisma.user.findUnique({ where: { phoneNumber: decoded.phoneNumber } })
    if (!user || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Unauthorised — session has been revoked, please log in again' }); return
    }
    req.phoneNumber = decoded.phoneNumber
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorised — invalid or expired token' })
  }
}
```

**User / Garage models:**
```prisma
model User {
  id                String    @id @default(cuid())
  phoneNumber       String    @unique
  email             String?   @unique
  userType          String?
  pushToken         String?
  notificationPrefs String?
  profilePhotoUrl   String?
  tokenVersion      Int       @default(0)
  createdAt         DateTime  @default(now())
  vehicles          Vehicle[]
  garage            Garage?
}

model Garage {
  id            String               @id @default(cuid())
  ownerPhone    String               @unique
  name          String
  address       String?
  addressLine   String?
  village       String?
  town          String?
  brNumber      String?
  verified      Boolean              @default(false)
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  owner         User                 @relation(fields: [ownerPhone], references: [phoneNumber])
  shareSessions ShareSession[]
  submissions   ServiceSubmission[]
  availability      GarageAvailability?
  bookings          Booking[]
  calendarOverrides GarageCalendarOverride[]
  reminders         GarageReminder[]
  ratings           GarageRating[]
  priceList     Json?
  photos        String[]
  aboutBio      String?
  services      String[]
  contactPhone  String?
  promoText     String?
  websiteUrl    String?
  googleMapsUrl String?
}
```
Models with `ownerPhone`: `Vehicle`, `Garage`, `GarageRating`, `ShareSession`, `Booking`, `VehicleShare`, `ServiceSubmission`.

**A person is identified by `phoneNumber`**, not `User.id` — every relation uses `references: [phoneNumber]`, and `authMiddleware` looks up by phone. Mart should follow this same convention (key listings/orders by phone, not a separate user id) for consistency.

**Owner vs. garage role:** no role table — a single `userType String?` field on `User` (`'owner'`/`'garage'`), set via `PUT /auth/user-type`. `Garage` is an optional one-to-one off `User`. **One phone number can be both simultaneously** (confirmed by schema + CLAUDE.md's explicit "dual role" design decision).

**Profile:** `ProfileScreen.tsx` — editable: **photo** (via `/uploads/photo`, saved as `User.profilePhotoUrl`) and **email** (`PATCH /auth/email`). Phone shown, not editable. **No `name` field, no `district`/`location` field on `User` — does not exist.** (`Garage` has `village`/`town`, but that's the business entity, not the owner's profile — Mart would need its own seller-location fields if required.)

---

## C. Vehicles

**Brand/model picker:** `mobile/src/constants/vehicleData.ts` — a plain TS object (`BRAND_MODELS: Record<string, string[]>`). **Fully static/bundled client-side — no endpoint serves it.**

**Fetching owner's vehicles:**
```ts
getVehicles: async (token: string) => {
  const res = await fetch(`${API_URL}/vehicles`, { headers: authHeaders(token) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch vehicles')
  return data
}
```
Called from `MyVehiclesScreen.tsx`'s `loadAll()` on mount.

---

## D. Existing ratings and bookings (the closest precedent for Mart's own patterns)

**GarageRating model:**
```prisma
model GarageRating {
  id           String   @id @default(cuid())
  garageId     String
  vehicleId    String
  ownerPhone   String
  submissionId String   @unique   // 1 rating per completed job — the "verified review" guard
  rating       Int
  comment      String?
  createdAt    DateTime @default(now())
  garage       Garage   @relation(fields: [garageId], references: [id], onDelete: Cascade)
}
```

**`POST /service-submissions/:id/rate`** (`backend/src/routes/serviceSubmissions.ts:446-479`):
```ts
router.post('/:id/rate', async (req: AuthRequest, res) => {
  const id = req.params.id as string
  const { rating, comment } = req.body
  const ratingNum = Number(rating)
  if (!ratingNum || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: 'rating must be a whole number between 1 and 5' }); return
  }
  try {
    const submission = await prisma.serviceSubmission.findFirst({
      where: { id, ownerPhone: req.phoneNumber!, status: 'accepted' },
    })
    if (!submission) { res.status(404).json({ error: 'Submission not found or not accepted' }); return }
    if (!submission.garageId) { res.status(400).json({ error: 'This submission has no garage to rate' }); return }

    const existing = await prisma.garageRating.findUnique({ where: { submissionId: id } })
    if (existing) { res.status(409).json({ error: 'You already rated this service' }); return }

    const created = await prisma.garageRating.create({
      data: {
        garageId: submission.garageId,
        vehicleId: submission.vehicleId,
        ownerPhone: req.phoneNumber!,
        submissionId: id,
        rating: ratingNum,
        comment: comment?.trim() ? capText(comment, LONG_TEXT_LEN) : null,
      },
    })
    res.status(201).json(created)
  } catch (error) {
    console.error('POST /service-submissions/:id/rate error:', error)
    res.status(500).json({ error: 'Failed to submit rating' })
  }
})
```

**`GET /garages/:id/ratings` + `getRatingStats`** (`backend/src/routes/garages.ts:348-381`):
```ts
router.get('/:id/ratings', async (req: AuthRequest, res) => {
  const garageId = req.params.id as string
  try {
    const [distGroups, reviews, stats] = await Promise.all([
      prisma.garageRating.groupBy({ by: ['rating'], where: { garageId }, _count: { rating: true } }),
      prisma.garageRating.findMany({
        where: { garageId, comment: { not: null } },
        orderBy: { createdAt: 'desc' }, take: 30,
        select: { rating: true, comment: true, createdAt: true },
      }),
      getRatingStats(garageId),
    ])
    const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
    distGroups.forEach(g => { distribution[String(g.rating)] = g._count.rating })
    res.json({ ...stats, distribution, reviews })
  } catch (error) {
    console.error('GET /garages/:id/ratings error:', error)
    res.status(500).json({ error: 'Failed to fetch ratings' })
  }
})

async function getRatingStats(garageId: string): Promise<{ avgRating: number | null; ratingCount: number }> {
  const agg = await prisma.garageRating.aggregate({
    where: { garageId }, _avg: { rating: true }, _count: { rating: true },
  })
  return {
    avgRating: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
    ratingCount: agg._count.rating,
  }
}
```

**Mobile rating prompt** (`mobile/src/screens/VehicleDashboardScreen.tsx`) — state (`219-222`):
```ts
const [ratingPrompt, setRatingPrompt] = useState<{ submissionId: string; garageName: string } | null>(null)
const [ratingValue, setRatingValue] = useState(0)
const [ratingComment, setRatingComment] = useState('')
const [submittingRating, setSubmittingRating] = useState(false)
```
Triggered automatically right after `handleAccept` succeeds (`409-427`), if the submission came from a real garage. Modal (`1532-1576`): 1–5 star picker (`AppIcon` `mci star`/`star-outline`), optional multiline comment, Skip always available, disabled submit until a star is picked.

**ServiceSubmission / Booking / BookingNote models:**
```prisma
model ServiceSubmission {
  id               String    @id @default(cuid())
  shareSessionId   String?
  bookingId        String?
  vehicleId        String
  garageId         String?
  submittedByPhone String?
  ownerPhone       String
  description      String
  serviceDate      DateTime?
  parts            String?
  brand            String?
  mileage          Int?
  cost             Float?
  notes            String?
  structuredData   Json?
  categories       String[] @default([])
  photos           String[]
  status           String    @default("pending")
  createdAt        DateTime  @default(now())
  vehicle          Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  garage           Garage?  @relation(fields: [garageId], references: [id], onDelete: Cascade)
}

model Booking {
  id             String        @id @default(cuid())
  vehicleId      String
  garageId       String
  ownerPhone     String
  date           DateTime
  slotLabel      String?
  status         String        @default("pending")
  notes          String?
  noteType       String        @default("normal")
  serviceType    String?
  shareSessionId String?
  reminderSent   Boolean       @default(false)
  reminder1hSent Boolean       @default(false)
  counterDate    DateTime?
  counterSlot    String?
  createdAt      DateTime      @default(now())
  vehicle        Vehicle       @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  garage         Garage        @relation(fields: [garageId], references: [id], onDelete: Cascade)
  bookingNotes   BookingNote[]
}

model BookingNote {
  id          String   @id @default(cuid())
  bookingId   String
  senderPhone String
  message     String
  createdAt   DateTime @default(now())
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}
```

**Messaging:** `GET/POST /bookings/:id/notes`, rate-limited 60/hour, triggers push + `AppNotification` side effects. **No WebSocket anywhere in the backend — does not exist.** **No interval-based polling either** — messages fetch only on thread expand or screen focus. If Mart needs buyer/seller chat, this REST-on-demand pattern is the convention to match, not sockets.

---

## E. Images, files and notifications

**Image upload:** Cloudflare R2 via `@aws-sdk/client-s3`. `POST /uploads/photo`, multer memory storage, **5MB limit**, magic-byte sniffing for JPEG/PNG/WEBP/GIF (doesn't trust client mimetype). **No server-side compression/resizing (no `sharp`)** — only client-side `quality: 0.7` via `expo-image-picker`. Object key: `service-photos/${sha256(phone).slice(0,16)}/${uuid}.${ext}` (phone hashed, not raw, to keep PII out of the public URL). Rate-limited 60/hour. Mobile upload uses `expo-file-system`'s `FileSystem.uploadAsync` (not fetch/FormData — explicit New Architecture workaround), 30s manual timeout.

**Push notifications:** Expo push service only (`https://exp.host/--/api/v2/push/send`), not direct FCM/APNs. Token stored as `User.pushToken String?`.
```prisma
model AppNotification {
  id        String   @id @default(cuid())
  userPhone String
  type      String
  title     String
  body      String
  linkTo    String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```
Routes (`backend/src/routes/notifications.ts`): `GET /` (list), `GET /unread-count`, `POST /read-booking/:bookingId`, `POST /read-all`.

**Email: does not exist anywhere in the codebase** (no nodemailer/sendgrid/resend/smtp/ses). `User.email` is stored/displayed only, never sent to.

---

## F. Shared patterns to reuse

```ts
// backend/src/utils/validate.ts
export const MAX_AMOUNT = 100_000_000
export const MAX_MILEAGE = 5_000_000
export const SHORT_TEXT_LEN = 300
export const LONG_TEXT_LEN = 3000
export function capText(value: unknown, maxLen: number): string {
  return String(value).slice(0, maxLen)
}
```
Validation = manual if-checks per route, **no zod/joi anywhere**. Error shape: consistently `{ error: "<message>" }`. **No pagination convention exists** — only hardcoded `take: N` caps. Rate limiting: `checkRateLimit(scope, key, max, windowMs)`, plus a global per-IP backstop middleware (600 req/5min).

**IDs:** `cuid()` everywhere. **No soft-delete anywhere** — hard deletes via `onDelete: Cascade`. **No Prisma `enum` blocks** — status fields are plain `String` with a default literal, values enforced only in route logic.

**Theme** (`mobile/src/theme/colors.ts`):
```ts
export const lightColors = {
  background: '#f5f5f5', surface: '#ffffff', text: '#1a1a1a',
  primary: '#1d3a5f',   // navy
  accent: '#e3a008',    // amber
  success: '#43a047', error: '#e53935', warning: '#f9a825', ...
}
```
⚠️ Note: your branding memory separately records navy/amber as `#012362`/`#F5A623`, sampled from the real app logo later — reconcile which is authoritative before Mart reuses either.

Shared components (`mobile/src/components/`): `AppIcon.tsx`, `BottomTabBar.tsx`, `Button.tsx`, `Chip.tsx`, `DateField.tsx`, `DonutChart.tsx`, `FloatingHomeButton.tsx`, `FormField.tsx`, `ScreenHeader.tsx`, `Sparkline.tsx`, `VehicleHealthSummaryCard.tsx`. Icons: `@expo/vector-icons` (`Ionicons`/`MaterialIcons`/`MaterialCommunityIcons`, overwhelmingly `mci`).

**i18n:** `mobile/src/i18n/` — `LanguageContext.tsx` + `translations/en.ts`/`si.ts`/`ta.ts`. Fallback: `dict[key] ?? en[key] ?? key`.

**Deep links:** **does not exist** — no `scheme`, `associatedDomains`, or `intentFilters` in `app.json`. No confirmed live marketing domain in-repo (only a `vocksy.dev` email reference and an HTML mockup).

---

## G. Infrastructure and rules

Deployed on **Render** (`backend/render.yaml`, free plan, `healthCheckPath: /health`). **No `prisma/migrations/` folder — `prisma db push` is the workflow**, run manually. **No `.env.example`. No tests exist anywhere.**

From CLAUDE.md, most relevant to Mart's design:

> "**No reject/dispute button in the app** — if there is a discrepancy, the owner and garage resolve it in person or by phone. The app is not a dispute platform."

Confirmed Design Decisions include: Sell transfer (full record move), Reject/dispute (not included), Photo storage (cloud — note: compression is only client-side `quality:0.7`, not actually server-enforced to 200–400KB as the doc states), Garage BR (optional, verified badge only), Garage dual role (yes), Offline (queues writes locally), Launch pricing (free 3–4 months then tiered), Mileage unit (km), Currency (LKR).

Security baseline for any new route: JWT fail-closed, phone-based IDOR scoping (`where: { ..., ownerPhone: req.phoneNumber! }` pattern), magic-byte file validation, input length caps via `capText`, rate limiting on spam-prone writes, global per-IP backstop, token revocation via `tokenVersion`.

---
---

# Part 2 — UI Patterns, Notifications, Roles, Platform Constraints

Compiled 2026-10-04, same rules (verified code only, file paths + line numbers, "does not exist" where applicable).

## A. Existing UI patterns

**ScreenHeader** (`mobile/src/components/ScreenHeader.tsx:7-12`):
```ts
type Props = {
  title: string
  subtitle?: string
  onBack: () => void
  rightElement?: React.ReactNode
}
```
~22 of 29 screens import it; the rest (auth/onboarding-type screens) build their own or have none.

**Modals/bottom sheets:** No library installed (no react-native-modal, no @gorhom/bottom-sheet). Plain RN `Modal` styled as a custom sheet everywhere:
```tsx
<Modal visible={!!ratingPrompt} transparent animationType="slide" onRequestClose={() => setRatingPrompt(null)}>
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={styles.moreSheetOverlay}>
      <View style={styles.moreSheetCard}>
```

**Confirmations/feedback:** `Alert.alert` — 200 call sites across 23 files. **No toast/snackbar component exists.** Example: `Alert.alert(t('common.error'), error.message)`.

**Empty/loading/error states:** No shared component (does not exist — no EmptyState.tsx/LoadingView.tsx). Each screen handles it inline, e.g. `NotificationsScreen.tsx:110-117`:
```tsx
{loading ? (
  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
) : notifs.length === 0 ? (
  <View style={styles.empty}>
    <AppIcon icon={{ lib: 'mci', name: 'bell-outline' }} size={44} color={colors.textFaint} />
    <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
  </View>
) : ( <FlatList ... /> )}
```
`RefreshControl` component: does not exist in NotificationsScreen. **Pull-to-refresh exists via FlatList's own `onRefresh`/`refreshing` props** (confirmed in MyVehiclesScreen.tsx, not the RefreshControl component directly).

**Card styling:** Cards use **both** soft shadows and thin borders together (not purely flat, not purely shadow-based):
```ts
// NotificationsScreen.tsx
card: { borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }
// BookingScreen.tsx booking card
{ backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: c.borderMid, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }
```
`borderRadius` clusters 10-16, padding 12-20.

`Chip.tsx` props: `{ label: string; selected: boolean; onPress: () => void }`. `Button.tsx` props: `{ title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'destructive' }` (no `size` prop).

**FloatingHomeButton.tsx:** a single circular 48×48 "return home" shortcut (`position: absolute, right: 16, bottom: insets.bottom + 20`), unconditionally rendered by whichever screen includes it — not a generic FAB pattern. **No "+"-style FAB exists anywhere** (grep for "FAB" = zero matches). "+ Add Vehicle" is a normal full-width rectangular button — the "+" is a literal character in the label text, not an icon.

**Photo picking** (`AddServiceRecordScreen.tsx`):
```ts
await ImagePicker.requestCameraPermissionsAsync() / requestMediaLibraryPermissionsAsync()
await ImagePicker.launchCameraAsync({ quality: 0.7 })
await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining })
const url = await api.uploadPhoto(token, compressed.uri)
```
Multi-select exists (`allowsMultipleSelection: true`). **No shared fullscreen photo viewer component** — 3 screens (BookingScreen, VehicleDashboardScreen, VehicleHistoryScreen) each independently reimplement a swipeable `Modal` + paging `FlatList` viewer. GarageScreen displays its `photos[]` as a horizontal scroll strip of thumbnails (not a grid).

**Search/filter:** `MyVehiclesScreen.tsx` has a free-text search `TextInput` ("Search by registration, make or model..."). `VehicleHistoryScreen.tsx` has hand-rolled filter-chip rows (category/date/mileage) — **built with local TouchableOpacity styles, not the shared `Chip.tsx` component.**

**Formatting:** **No `formatCurrency` helper exists** — `` `LKR ${amount.toLocaleString()}` `` is written inline in 13+ screen files. **No shared relative-time helper** — a private `timeAgo()` function lives only inside `NotificationsScreen.tsx` (not exported/reused elsewhere); other screens show raw `toLocaleDateString()`.

## B. Notifications in detail

**`backend/src/utils/appNotifications.ts`** (full):
```ts
export async function createNotification(prisma: PrismaClient, userPhone: string, type: string, title: string, body: string, linkTo?: object) {
  try {
    await prisma.appNotification.create({ data: { userPhone, type, title, body, linkTo: linkTo ? JSON.stringify(linkTo) : null } })
  } catch {
    // non-fatal — notifications must never block the main operation
  }
}
```

**`backend/src/utils/push.ts`** (full):
```ts
export async function sendPush(pushToken: string | null | undefined, title: string, body: string, data?: Record<string, unknown>) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-encoding': 'gzip, deflate' },
      body: JSON.stringify({ to: pushToken, title, body, data: data || {} }),
    })
  } catch (e) { console.error('Push send failed:', e) }
}
```
**No batching** — single `pushToken` param, called once per user in a loop everywhere (confirmed across all 4 jobs). **Fire-and-forget: the Expo response body is never read** — no `.json()`, no check for `DeviceNotRegistered`/invalid-token errors Expo returns in a 200 response. A stale `pushToken` is never cleared. Worth hardening before Mart scales notification volume.

**All `type` values in use** (18 `createNotification` call sites): `booking_reminder`, `booking_reminder_1h`, `emission_reminder`, `licence_reminder`, `insurance_reminder`, `setup_reminder`, `service_reminder`, `mileage_reminder`, `booking_counter`, `booking_counter_accepted`, `booking_counter_declined`, `garage_reminder`, `family_share`, `transfer_accepted`, `transfer`, `submission`, `submission_accepted`, `submission_rejected`, `booking_request`, `booking_confirmed`, `booking_cancelled`, `message`.

**`linkTo` shapes in use:** `{ screen: 'vehicles', vehicleId }`, `{ screen: 'garage', bookingId }` / `{ screen: 'garage' }`, `{ screen: 'vehicleDashboard', vehicleId }`, `{ screen: 'predictions', vehicleId }`, `{ screen: 'vehicleDashboard', vehicleId, bookingId }`, `{ screen: 'vehicles' }`. The 'message' type specifically: owner→garage is `{ screen: 'garage', bookingId: id }`; garage→owner is `{ screen: 'vehicleDashboard', vehicleId: booking.vehicleId, bookingId: id }` (`backend/src/routes/bookings.ts:451-472`, confirmed directly).

**Tap handling:** `NotificationsScreen.tsx` does **not** parse `linkTo` itself — it just forwards the raw string. The actual `JSON.parse` + routing switch lives in `mobile/App.tsx:725-751`:
```ts
onNavigate={(linkTo) => {
  if (!linkTo) { setScreen('vehicles'); return }
  try {
    const { screen: target, vehicleId, bookingId } = JSON.parse(linkTo)
    if (target === 'garage') { if (bookingId) setFocusBookingId(bookingId); setScreen('garage'); return }
    if (target === 'predictions_setup' && vehicleId) { /* find vehicle, setScreen('predictions') */ }
    if ((target === 'vehicleDashboard' || target === 'vehicles') && vehicleId) { /* find vehicle, setScreen('vehicleDashboard') */ }
  } catch {}
  setScreen('vehicles')
}}
```
Falls back to the vehicle list on parse failure or an unmatched target — Mart's own `linkTo` targets will need a matching branch added here.

**`notificationPrefs`:** stored as `JSON.stringify(prefs)` on `User.notificationPrefs String?`. ⚠️ **Bug worth knowing about:** `PUT /auth/notification-prefs` only destructures/persists 7 keys (`service_due, mileage_reminder, renewal, insurance_reminder, booking, transfer, submission`) — it silently drops `garage_reminder` even though `NotificationPrefsScreen.tsx` renders a toggle for it and `routes/garages.ts` checks for it. The `parsePrefs()` function is **duplicated verbatim across 6 backend files** (not a shared util):
```ts
function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}
```
Mart should add its own key (e.g. `mart_message`, `mart_offer`) to this pattern — and ideally this is a good moment to extract it to a shared `utils/notificationPrefs.ts` rather than adding a 7th copy.

**Job scheduling:** Plain `setInterval`, **not node-cron**. `backend/src/jobs/bookingReminders.ts:108-120`:
```ts
export function startBookingReminderJob() {
  checkBookingReminders().catch(e => console.error(...))
  setInterval(() => { checkBookingReminders().catch(e => console.error(...)) }, 60 * 60 * 1000)
  checkOneHourReminders().catch(e => console.error(...))
  setInterval(() => { checkOneHourReminders().catch(e => console.error(...)) }, 15 * 60 * 1000)
}
```
Started unconditionally in `backend/src/index.ts`'s `app.listen()` callback — no separate worker process. **Render free plan** (`render.yaml: plan: free`) sleeps on inactivity; CLAUDE.md notes the paid plan "eliminates free-tier sleep" but doesn't document the specific consequence for these `setInterval` timers (they'd reset on every cold start). Worth flagging if Mart adds its own time-sensitive jobs.

## C. Garage and role details

**Rating badge/modal reuse:** **Not reusable — inline duplicated in each screen.** No `RatingBadge.tsx` or similar exists in `mobile/src/components/`. `GarageScreen.tsx` (badge: lines 1368-1376, modal: lines 2619-2629+) and `BookingScreen.tsx` (lines 360-403, a different inline-accordion interaction model, not a modal) are two independently written implementations with separate styles. **Building a shared `RatingBadge`/`ReviewsModal` component now — for both garage and future Mart seller ratings — would be new, worthwhile scope**, not something to copy-paste a third time.

**`hasGarage`:** derived by calling `api.getGarage(token)` and checking success/404 (`App.tsx:274`) — not a field on the vehicles response. Gates the bottom-tab visibility (`App.tsx:465`).

**`RoleSelectScreen.tsx`:** only calls `api.setUserType(token, selected)` (sets `User.userType`) — does **not** create a `Garage` record itself; picking "garage" just routes to `GarageScreen`, which shows its own registration form if none exists yet.

**Can a user add a role later? Yes — does exist.** `ProfileScreen.tsx:194-206` shows a "Register Garage" row (badged "NEW") for any owner-only user, routing to `GarageScreen`'s registration form. So the initial role choice is **not a hard lock** — dual-role can be acquired anytime via Profile.

**Garage profile editing:** No separate edit screen — inline within `GarageScreen.tsx` itself via an `editing` state toggle, same form serves registration and editing. Editable fields: `name` (required), `addressLine` (optional), `village`/`town` (required, free-text), `brNumber`, `aboutBio`, `services` (free-text), `contactPhone`, `promoText`, `websiteUrl`, `googleMapsUrl`, `photos` (up to 5). These are the realistic fields a "Shop profile" for Mart would reuse/mirror.

**Sri Lanka district/town list: does not exist anywhere** — `village`/`town` on GarageScreen are plain free-text `TextInput`s, no autocomplete or constant data file. Mart would need to build any location picker from scratch.

## D. Platform and release constraints

**Offline queue: does not exist in code** — "App queues writes locally and syncs when connectivity returns" is a CLAUDE.md design statement with **no actual implementation** found in `mobile/src` (no "offline"/"queue"/"NetInfo" anywhere). In reality, the global fetch patch (`mobile/src/config/api.ts:11-16`) just throws a friendly "Could not connect" error on any network failure — writes simply fail with an alert when offline, they are not queued. **A Mart write (post an ad, send a message) would behave the same way today: fail immediately offline, no retry/queue** — unless this gets built as shared infrastructure first.

**Release process:** EAS build profiles (`development`, `preview`, `production`) in `eas.json`. OTA via `expo-updates` (`~29.0.20`), `app.json`:
```json
"runtimeVersion": { "policy": "appVersion" },
"updates": { "url": "https://u.expo.dev/52491a26-210a-49c1-a92a-beb220b9ad52" }
```
**No API versioning** (all routes unprefixed, e.g. `app.use('/bookings', bookingRoutes)`). **No minimum-app-version enforcement** — old app versions keep working against new backend code indefinitely, with no server-side gate. Mart's backend changes need to stay backward-compatible with whatever's already installed, since there's no way to force an update.

**app.json:** no `"scheme"` field (does not exist). `ios.bundleIdentifier` / `android.package`: `com.vocksy.app`. Android permissions: `CAMERA`, `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`. `expo-sharing` is used (`mobile/src/utils/pdfExport.ts`, `Sharing.shareAsync(...)`). React Native `Share` API: not used. `Linking`: exactly 3 call sites, all in `BookingScreen.tsx` (phone call, website, Google Maps — see below).

**External links** (`BookingScreen.tsx:334,341,348`):
```ts
Linking.openURL(`tel:${garage.contactPhone}`)
Linking.openURL(garage.websiteUrl!.startsWith('http') ? garage.websiteUrl! : `https://${garage.websiteUrl}`)
Linking.openURL(garage.googleMapsUrl!.startsWith('http') ? garage.googleMapsUrl! : `https://${garage.googleMapsUrl}`)
```
**No shared helper** (`openPhone`/`openWhatsApp` — does not exist); each call inlines its own URL-fixup logic. **No WhatsApp integration exists** — "WhatsApp" only appears as a label hint ("Contact Phone / WhatsApp (optional)"), there's no `wa.me` link anywhere. **No support contact email/address found anywhere** in the app or docs.

**Hosting/DB limits:** Render **free** plan (`render.yaml`). Neon free tier: "7-day backup window and no off-platform backup" (CLAUDE.md), with a documented-but-unbuilt interim fix (daily `pg_dump` → R2). **No backup script exists today.** R2 env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

**Legal/moderation:** `docs/privacy-policy.html` is a **standalone web page only — no in-app Terms/Privacy screen exists.** No prohibited-items list anywhere. Account deletion: only a manual CLI script (`backend/src/scripts/deleteAccount.ts`, phone number as arg) — **no in-app "Delete my account" button exists.** **No block-user feature anywhere.** All of these are real gaps Mart will need (prohibited items list and in-app account deletion especially matter for a marketplace with user-generated listings).

## E. Analytics and moderation

**No analytics/crash-reporting service integrated anywhere** (no Sentry, Firebase Analytics, Mixpanel, Amplitude, PostHog — checked both `package.json` files). **No admin role or admin-only routes exist anywhere in the backend** (no `isAdmin`, no `role === 'admin'` check found). A marketplace with listings and messaging will likely need at least basic admin/moderation tooling (remove a listing, ban a user) that doesn't exist as a pattern to copy from elsewhere in this codebase — this would be new scope, not a reuse.

---
---

# Part 3 — answers for data model and API design

Compiled 2026-10-05, read-only, same verification rules as Parts 1-2.

## 1. Prisma models

Datasource/generator:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Every model name in `schema.prisma` (17 total — avoid clashing with any of these):
`User`, `Vehicle`, `ServiceRecord`, `Expense`, `FuelLog`, `Garage`, `GarageReminder`, `GarageRating`, `ShareSession`, `VehicleTransfer`, `GarageAvailability`, `GarageCalendarOverride`, `Booking`, `BookingNote`, `AppNotification`, `VehicleShare`, `ServiceSubmission`. **No model starts with "Mart" — confirmed no clash.**

`User` (push token lives here — `pushToken String?`, line 15):
```prisma
model User {
  id                String    @id @default(cuid())
  phoneNumber       String    @unique
  email             String?   @unique
  userType          String?
  pushToken         String?
  notificationPrefs String?
  profilePhotoUrl   String?
  tokenVersion      Int       @default(0)
  createdAt         DateTime  @default(now())
  vehicles          Vehicle[]
  garage            Garage?
}
```

`Vehicle`:
```prisma
model Vehicle {
  id             String              @id @default(cuid())
  registrationNo String              @unique
  make           String
  model          String
  year           Int
  fuelType       String
  vehicleType    String?
  mileage        Int
  ownerPhone     String
  purchaseDate   DateTime?
  ownerCount                Int?                @default(1)
  vehicleNotes              String?
  photoUrl                  String?
  emissionTestExpiry        DateTime?
  revenueLicenceExpiry      DateTime?
  insuranceExpiry           DateTime?
  insuranceCompany          String?
  insurancePolicyNo         String?
  insurancePolicyHistory    Json?
  revenueLicenceHistory     Json?
  lastEmissionReminderSent  DateTime?
  lastLicenceReminderSent   DateTime?
  lastInsuranceReminderSent DateTime?
  intervalOverrides         Json?
  neverDoneConfirmed        Json?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  owner          User                @relation(fields: [ownerPhone], references: [phoneNumber])
  serviceRecords ServiceRecord[]
  fuelLogs       FuelLog[]
  expenses       Expense[]
  shareSessions  ShareSession[]
  submissions    ServiceSubmission[]
  transfers      VehicleTransfer[]
  bookings       Booking[]
  vehicleShares  VehicleShare[]
}
```

`Garage`:
```prisma
model Garage {
  id            String               @id @default(cuid())
  ownerPhone    String               @unique
  name          String
  address       String?
  addressLine   String?
  village       String?
  town          String?
  brNumber      String?
  verified      Boolean              @default(false)
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt
  owner         User                 @relation(fields: [ownerPhone], references: [phoneNumber])
  shareSessions ShareSession[]
  submissions   ServiceSubmission[]
  availability      GarageAvailability?
  bookings          Booking[]
  calendarOverrides GarageCalendarOverride[]
  reminders         GarageReminder[]
  ratings           GarageRating[]
  priceList     Json?
  photos        String[]
  aboutBio      String?
  services      String[]
  contactPhone  String?
  promoText     String?
  websiteUrl    String?
  googleMapsUrl String?
}
```

`GarageRating` (the review model):
```prisma
model GarageRating {
  id           String   @id @default(cuid())
  garageId     String
  vehicleId    String
  ownerPhone   String
  submissionId String   @unique
  rating       Int
  comment      String?
  createdAt    DateTime @default(now())
  garage       Garage   @relation(fields: [garageId], references: [id], onDelete: Cascade)
}
```

## 2. Auth

**Name/file:** `authMiddleware`, `backend/src/middleware/auth.ts` (full code already quoted in Part 1 §4 of this doc — unchanged). Puts `req.phoneNumber` on the request (not a user id). **JWT is used**, HS256, **30-day expiry**, signed with `{ phoneNumber, tokenVersion }`. Login: phone OTP (6-digit, in-memory `Map`, 5-min expiry, delivered only via `console.log` — no real SMS provider), verified against the stored code, then a JWT issued.

Example protected route (`backend/src/routes/vehicles.ts`):
```ts
router.use(authMiddleware)
router.get('/', async (req: AuthRequest, res) => {
  const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: req.phoneNumber } })
  ...
```

## 3. Garage rating — endpoints, rules, calculation

**Endpoints:**
- `POST /service-submissions/:id/rate` — create a rating
- `GET /garages/:id/ratings` — distribution + reviews + stats
- (implicitly) `GET /garages/:id` and `GET /garages` — both decorate their response with `avgRating`/`ratingCount` via `getRatingStats()`

**Rules:** One rating **per completed `ServiceSubmission`** (not per booking, not per user-garage pair) — enforced by `GarageRating.submissionId @unique` plus an explicit `findUnique` duplicate check (409 on repeat). Submission must belong to the caller (`ownerPhone: req.phoneNumber!`) and have `status: 'accepted'`. **No edit endpoint exists** — once submitted, a rating cannot be changed via the API (does not exist).

**Calculation:** **Computed on read, not stored/cached on `Garage`.** `getRatingStats()` runs `prisma.garageRating.aggregate({ _avg: { rating: true }, _count: { rating: true } })` live on every call — there is no `Garage.avgRating` column being kept in sync.

**Request** (`POST /service-submissions/:id/rate`):
```json
{ "rating": 5, "comment": "Great service, fast turnaround" }
```
**Response** (201):
```json
{ "id": "...", "garageId": "...", "vehicleId": "...", "ownerPhone": "+9477...", "submissionId": "...", "rating": 5, "comment": "Great service, fast turnaround", "createdAt": "2026-10-05T..." }
```
**Response** (`GET /garages/:id/ratings`):
```json
{
  "avgRating": 4.6,
  "ratingCount": 12,
  "distribution": { "5": 8, "4": 3, "3": 1, "2": 0, "1": 0 },
  "reviews": [ { "rating": 5, "comment": "...", "createdAt": "..." } ]
}
```
Full route code already quoted in full in Part 1 §10 / Part 2 §D of this doc — unchanged, not re-pasted here.

## 4. Vehicle fields for a "Matches you" tag

`make String`, `model String`, `year Int` — **three separate plain scalar fields**, no enum, no foreign key to a makes/models table. Backend validation (`backend/src/routes/vehicles.ts:60`) only checks `!make`/`!model` (non-empty) and length-caps via `capText` — **values are NOT validated against any fixed list server-side.** A client could technically POST any string.

On mobile, values are **constrained by UI only** (picker + "Other" free-text fallback), from:
```ts
// mobile/src/constants/vehicleData.ts
export const BRAND_MODELS: Record<string, string[]> = {
  'Toyota': [
    'Aqua', 'Axio', 'Allion', 'Premio', 'Corolla',
    'Prius', 'Vitz / Yaris', 'Fielder', 'Camry',
    'Noah / Voxy', 'Alphard', 'Vellfire',
    'HiAce (KDH)', 'HiAce Wagon', ...
  ],
  ...
```
**Lives in `mobile` only — DOES NOT EXIST in `backend`.** If Mart needs to match parts listings to a buyer's registered vehicle make/model, it will be matching against free-form strings the backend never validated — worth deciding whether to finally centralize this list (mobile-only today, per the existing Backlog Ideas note in CLAUDE.md about `car-petrol`/`car-diesel` vehicleType string consistency — a related, already-flagged inconsistency).

## 5. Mobile app basics

**(a) Theme/colors** — `mobile/src/theme/colors.ts` (full file):
```ts
export type Colors = typeof lightColors
export const lightColors = {
  background: '#f5f5f5', surface: '#ffffff', surfaceAlt: '#fafafa',
  text: '#1a1a1a', textBody: '#333333', textSub: '#555555', textMuted: '#888888', textFaint: '#aaaaaa',
  border: '#eeeeee', borderMid: '#dddddd', borderStrong: '#cccccc',
  primaryTint: '#e7edf3', primaryTintText: '#1d3a5f',
  primary: '#1d3a5f',   // brand primary — navy
  accent: '#e3a008',    // brand accent — amber
  accentTint: '#fbf0d9', accentTintText: '#8a6300',
  success: '#43a047', error: '#e53935', warning: '#f9a825', orange: '#fb8c00',
}
export const darkColors: Colors = { /* equivalent dark-mode keys */ }
```

**(b) API client wrapper** — `mobile/src/config/api.ts:25-30`:
```ts
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
```
Every `api.*` function: `fetch → res.json() → if (!res.ok) throw new Error(data.error || fallback) → return data`. **No special 401 handling** — a 401 is thrown as a generic `Error` like any other failure (confirmed: no `401`/`Unauthorised`/auto-logout interceptor anywhere in `api.ts`), caught by whichever screen called it, shown via `Alert.alert`. A global patch (same file, lines 11-16) also catches raw network failures and JSON-parse failures, converting them into friendly messages before any screen sees them.

**(c) Bottom tab bar** — `mobile/App.tsx:460-466`:
```tsx
<BottomTabBar
  activeTab={screen === 'garage' ? 'garage' : 'vehicles'}
  onTabPress={(tab) => { setGarageEntryFrom('tab'); setGarageReturnTab('profile'); setScreen(tab); loadNotifCount(token) }}
  vehiclesBadge={vehiclesBadge}
  garageBadge={garageBadge}
  showGarageTab={hasGarage || screen === 'garage'}
/>
```
Only rendered when `screen` is in `TAB_SCREENS` (`App.tsx:72`): `const TAB_SCREENS: Screen[] = ['vehicles', 'garage']`.

**(d) Screen union + backMap** — `mobile/App.tsx:40-45`:
```ts
type Screen =
  | 'loading' | 'login' | 'otp' | 'roleSelect' | 'emailSetup'
  | 'vehicles' | 'garage' | 'garageLedger'
  | 'addVehicle' | 'onboardingWizard' | 'vehicleDashboard' | 'addServiceRecord'
  | 'logFuel' | 'tripLog' | 'addExpense' | 'vehicleTests' | 'vehicleHistory' | 'analytics' | 'predictions' | 'share' | 'sell' | 'booking' | 'knowledgeHub' | 'costForecast'
  | 'profile' | 'settings' | 'notificationPrefs' | 'notifications'
```
`backMap` — `mobile/App.tsx:278-302`:
```ts
const backMap: Partial<Record<Screen, Screen>> = {
  otp: 'login',
  addVehicle: 'vehicles',
  vehicleDashboard: 'vehicles',
  addServiceRecord: addServiceReturnTo,
  logFuel: 'vehicleDashboard',
  tripLog: 'vehicleDashboard',
  addExpense: 'vehicleDashboard',
  vehicleTests: 'vehicleDashboard',
  vehicleHistory: historyReturnTo,
  analytics: 'vehicleDashboard',
  predictions: 'vehicleDashboard',
  knowledgeHub: knowledgeHubReturnTo,
  share: 'vehicleDashboard',
  sell: 'vehicleDashboard',
  booking: 'vehicleDashboard',
  onboardingWizard: 'vehicles',
  costForecast: 'vehicleDashboard',
  profile: 'vehicles',
  settings: 'profile',
  notificationPrefs: notifPrefsReturnTo,
  notifications: 'vehicles',
  garageLedger: 'garage',
  ...(garageEntryFrom === 'profile' && !hasGarage ? { garage: 'profile' as Screen } : {}),
}
```
A "Mart" screen and its sub-screens would need entries added to both the `Screen` union and this `backMap` (plus a third `TAB_SCREENS` entry if Mart gets its own bottom tab, per your Part-1 discussion).

**(e) Example screen structure** — `mobile/src/screens/NotificationsScreen.tsx:1-30`:
```tsx
import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { api } from '../config/api'
import { useColors } from '../theme/ThemeContext'
import { Colors } from '../theme/colors'
import ScreenHeader from '../components/ScreenHeader'
import AppIcon, { AppIconSpec } from '../components/AppIcon'
import { useTranslation } from '../i18n/LanguageContext'

type AppNotification = { id: string; type: string; title: string; body: string; linkTo: string | null; read: boolean; createdAt: string }
type Props = { token: string; onBack: () => void; onNavigate: (linkTo: string | null) => void; onMarkAllRead: (seenBookingIds: string[]) => void; onSettings: () => void }
```
Loading/empty/error handling for this screen was already quoted in full in Part 2 §A — unchanged.

## 6. Anything like Mart already?

Searched the entire repo (backend + mobile, excluding node_modules) for: listing, marketplace, inventory, ads, favorite/favourite, follow, thread, report, parts, chat, messages, block.

**Every hit was a false positive**, unrelated to any marketplace concept:
- `mobile/src/screens/GarageScreen.tsx:2098` — comment "Messages thread" refers to the existing booking chat (`BookingNote`), not a Mart feature.
- `backend/src/routes/transfers.ts:128` — comment "all records follow the vehicle automatically" (vehicle transfer, unrelated word "follow").
- `backend/src/routes/notifications.ts:37` — comment about "booking message thread" (same booking chat).
- `backend/src/routes/auth.ts:54` — comment "instead of asking for it in chat" (referring to this Claude session, not an app feature).
- "parts" hits are all `ServiceRecord.parts` (vehicle parts replaced during a service) — an existing, unrelated field.
- "chat"/"block"/"report"/"inventory"/"listing"/"marketplace"/"favorite"/"ads" — **no genuine code hits found anywhere.**

**Confirmed: no existing model or route name starts with "Mart"** (see full model list in §1 above). **Vocksy Mart has zero existing implementation to build on or collide with — it is a clean, from-scratch addition.**

## 7. Deployment facts

- **Prisma:** `@prisma/client ^6.0.0`, CLI `prisma ^6.0.0` (both in `backend/package.json`).
- **Postgres version:** **not documented/pinned anywhere in the repo** — Neon manages this externally; no version string found in `schema.prisma`, `CLAUDE.md`, or env files.
- **Node version:** **no pin exists** — no `engines` field in `backend/package.json`, no `.nvmrc` anywhere in the repo.
- **`DATABASE_URL` on Render:** set as a `sync: false` env var in `backend/render.yaml` (i.e. configured manually in the Render dashboard, not synced from the repo/another service):
```yaml
envVars:
  - key: DATABASE_URL
    sync: false
```
- **Staging vs production:** **only one environment exists** — `backend/render.yaml` defines exactly one service (`techvehicle-backend`, `plan: free`). No staging service, no second Render service block of any kind.
- **Exact build/start commands** (`backend/render.yaml`):
```yaml
buildCommand: npm install && npm run build
startCommand: npm start
healthCheckPath: /health
```
(`npm run build` → `tsc`; `npm start` → `node dist/index.js`.)
- **Schema changes:** `prisma db push`, run **manually** from a developer's machine/Codespace — not an npm script, not part of the Render build/start commands, no `prisma/migrations/` folder exists. CLAUDE.md explicitly documents this as the required manual step each session.
- **Production DB backup:** **does not exist.** CLAUDE.md states Neon's free tier gives only a 7-day backup window with no off-platform copy, and separately flags an unbuilt "interim fix" (a daily `pg_dump` → R2 job) as still-pending work.

## 8. App status

- **Publication status:** Play Store submission was made (per CLAUDE.md: "Check whether the Google Play Store review of the submitted build has concluded" — still phrased as an open question as of that note, not confirmed resolved in this repo's own records). **`eas.json`'s submit config targets `track: "internal"`** (Play Store **internal testing track**, not the public Production track) — so even once approved, it is not confirmed to be live for the general public today. **No App Store (iOS) submission has happened at all** — per your own Part-1 discussion, iOS is still in the planning/TestFlight-via-friend's-account stage, nothing submitted.
- **Current version/build:** `app.json` → `"version": "1.0.3"`, `android.versionCode: 16`. (`mobile/package.json`'s own `"version": "1.0.0"` is just the npm package version, unrelated to the store-facing app version in `app.json`.)
- **Update delivery:** Both — native rebuilds via **EAS Build** (`development`/`preview`/`production` profiles in `eas.json`) for anything touching native code, plus **OTA updates via `expo-updates`** (`runtimeVersion: { policy: "appVersion" }`, pointed at `https://u.expo.dev/52491a26-210a-49c1-a92a-beb220b9ad52`) for pure-JS changes — confirmed in active use throughout your recent push-notification fix session (multiple `eas update --branch preview` publishes).
- **Production user count:** **no hint found anywhere in the repo** (no analytics, no user-count logging, nothing in CLAUDE.md/README/git log stating a number) — consistent with §E above (no analytics service exists at all). Not queried against production data, per your instruction.
- **Force-update/minimum-version mechanism: confirmed — does not exist**, matching Part 2 exactly. No `minVersion`/`forceUpdate`/`appVersion`-check code anywhere in `backend/src`, and no API versioning (`/v1/`, `/v2/`) either. Old installed app versions keep working against whatever the backend currently does, indefinitely, with no server-side gate.
