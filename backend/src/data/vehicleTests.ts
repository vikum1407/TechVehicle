// Exact ServiceRecord.description values written by Vehicle Tests screens, used by
// the admin panel's M3 "Vehicle tests" vs. "Service records" classification. Four of
// these are literal strings in mobile/src/screens/VehicleTestsScreen.tsx; the fifth
// (Emission Test) is NOT in that file at all — it's constructed in
// mobile/src/config/api.ts's logEmissionTest(), called by both VehicleTestsScreen's
// own Emission tab and the separate LogEmissionTestScreen.tsx. Found during the admin
// panel spec review (2026-10-26): a version of this list built by only copying from
// VehicleTestsScreen.tsx would silently miss Emission Test entirely, the same
// classification-drift bug class CLAUDE.md already documents (the Analytics double-
// counting incident) — keep this comment if this list is ever regenerated.
// keep in sync with: mobile/src/screens/VehicleTestsScreen.tsx, mobile/src/config/api.ts
export const VEHICLE_TEST_DESCRIPTIONS: string[] = [
  'Wheel Alignment',
  'Chain Lubrication',
  'Chain Tension Check',
  'Chain & Sprocket',
  'Emission Test / Carbon Test',
]
