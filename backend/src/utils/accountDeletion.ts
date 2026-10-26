import { PrismaClient, Prisma } from '@prisma/client'
import { sendPush } from './push'
import { createNotification } from './appNotifications'

// Apple App Review 5.1.1(v) + Google Play's account-deletion policy, agreed design
// 2026-10-25. Two-phase: DELETE /auth/account marks pendingDeletionAt (+14 days);
// a daily job (accountDeletionSweep.ts) hard-deletes once that passes.
//
// Hard delete needs to satisfy a real constraint: Booking/BookingNote rows must
// survive even after the vehicle owner or the garage deletes their account, so the
// OTHER party's own history/ledger doesn't silently lose entries (see the design
// note this was built from). Vehicle.ownerPhone and Garage.ownerPhone are required,
// unique-keyed FKs to User.phoneNumber - the lowest-risk way to keep a Vehicle/Garage
// row alive (for Booking's sake) while still fully deleting the User row is to
// reassign ownerPhone to a permanent sentinel "deleted accounts" User that always
// exists, rather than making ownerPhone nullable everywhere it's used as a required
// string throughout the codebase (a much bigger, riskier ripple).
export const DELETED_ACCOUNT_SENTINEL_PHONE = '::deleted-account::'

// Never a real, loggable-in number (isValidPhone requires a leading '+'), so this can
// never collide with or be reachable via the real OTP login flow.
export async function ensureSentinelUser(prisma: PrismaClient) {
  await prisma.user.upsert({
    where: { phoneNumber: DELETED_ACCOUNT_SENTINEL_PHONE },
    update: {},
    create: { phoneNumber: DELETED_ACCOUNT_SENTINEL_PHONE },
  })
}

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

// Cancels every still-active booking tied to a vehicle/garage about to be anonymized,
// notifying the OTHER party by name while that name is still real (must run before
// the anonymize step below). Mirrors the existing cancel endpoints' notification
// pattern (bookings.ts) so this looks the same as a normal cancellation to the
// recipient, not a special case.
async function cancelActiveBookingsFor(
  prisma: PrismaClient,
  where: { vehicleId: string } | { garageId: string },
  notifyRecipientPhone: (booking: { id: string; vehicleId: string; garageId: string; date: Date; ownerPhone: string }) => Promise<{ phone: string; title: string; body: string; data: Record<string, unknown> }>
) {
  const bookings = await prisma.booking.findMany({
    where: { ...where, status: { in: ['pending', 'confirmed'] } },
  })
  for (const booking of bookings) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } })
    const { phone, title, body, data } = await notifyRecipientPhone(booking)
    const recipient = await prisma.user.findUnique({ where: { phoneNumber: phone } })
    const prefs = parsePrefs(recipient?.notificationPrefs)
    if (prefs.booking) await sendPush(recipient?.pushToken, title, body, data)
    await createNotification(prisma, phone, 'booking_cancelled', title, body, data)
  }
}

// Exported so the DELETE /auth/account route can cancel a garage's active bookings
// immediately at request time (per the agreed design - not deferred to the 14-day
// hard-delete), while the garage's real name is still intact to put in the notice.
export async function cancelGarageBookingsNow(prisma: PrismaClient, garageId: string, garageName: string) {
  const dateStr = (d: Date) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  await cancelActiveBookingsFor(prisma, { garageId }, async booking => ({
    phone: booking.ownerPhone,
    title: 'Booking Cancelled',
    body: `${garageName} has cancelled your booking for ${dateStr(booking.date)}`,
    data: { screen: 'vehicles' },
  }))
}

// Exported for the same reason as cancelGarageBookingsNow - the owner-deletion side
// of the symmetric "cancel active bookings at request time" behavior.
export async function cancelVehicleBookingsNow(prisma: PrismaClient, vehicleId: string) {
  const dateStr = (d: Date) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  await cancelActiveBookingsFor(prisma, { vehicleId }, async booking => {
    const bookingGarage = await prisma.garage.findUnique({ where: { id: booking.garageId } })
    return {
      phone: bookingGarage?.ownerPhone ?? DELETED_ACCOUNT_SENTINEL_PHONE,
      title: 'Booking Cancelled',
      body: `A customer has cancelled their booking for ${dateStr(booking.date)}`,
      data: { screen: 'garage' },
    }
  })
}

// The actual hard-delete + anonymize, run once pendingDeletionAt has passed (or could
// be called directly for a manual/CLI deletion - this replaces deleteAccount.ts's own
// inline logic so both paths share one implementation). Also re-runs the booking-cancel
// sweep as a final safety net (cheap no-op if the request-time cancellation already
// caught everything - covers e.g. a booking that got confirmed after the request).
export async function hardDeleteAccount(prisma: PrismaClient, phoneNumber: string) {
  const user = await prisma.user.findUnique({ where: { phoneNumber } })
  if (!user) return

  await ensureSentinelUser(prisma)

  const vehicles = await prisma.vehicle.findMany({ where: { ownerPhone: phoneNumber } })
  const garage = await prisma.garage.findUnique({ where: { ownerPhone: phoneNumber } })

  if (garage) {
    await cancelGarageBookingsNow(prisma, garage.id, garage.name)

    // Garage's own exclusive config/history - not shared with the other party's own
    // screens, safe to fully delete (GarageRating explicitly agreed cascade-safe; the
    // others are purely the garage's own scheduling setup with no owner-facing view).
    await prisma.garageReminder.deleteMany({ where: { garageId: garage.id } })
    await prisma.garageRating.deleteMany({ where: { garageId: garage.id } })
    await prisma.garageCalendarOverride.deleteMany({ where: { garageId: garage.id } })
    await prisma.garageAvailability.deleteMany({ where: { garageId: garage.id } })

    // Anonymize in place - keep the row (and its id) alive so Booking.garageId (and
    // ShareSession/ServiceSubmission) keep resolving, just strip every identifying field.
    await prisma.garage.update({
      where: { id: garage.id },
      data: {
        ownerPhone: DELETED_ACCOUNT_SENTINEL_PHONE,
        name: 'Deleted Garage',
        address: null, addressLine: null, village: null, town: null,
        brNumber: null, verified: false, aboutBio: null, services: [],
        photos: [], contactPhone: null, promoText: null,
        websiteUrl: null, googleMapsUrl: null, priceList: Prisma.JsonNull,
      },
    })
  }

  for (const vehicle of vehicles) {
    await cancelVehicleBookingsNow(prisma, vehicle.id)

    // Fully the owner's own exclusive data - no other party has a screen showing these.
    await prisma.serviceRecord.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.fuelLog.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.expense.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.vehicleShare.deleteMany({ where: { vehicleId: vehicle.id } })
    await prisma.vehicleTransfer.deleteMany({ where: { vehicleId: vehicle.id } })

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        ownerPhone: DELETED_ACCOUNT_SENTINEL_PHONE,
        registrationNo: `DELETED-${vehicle.id}`,
        make: 'Deleted', model: 'Vehicle',
        photoUrl: null, vehicleNotes: null, purchaseDate: null,
        insuranceCompany: null, insurancePolicyNo: null,
        insurancePolicyHistory: Prisma.JsonNull, revenueLicenceHistory: Prisma.JsonNull,
        emissionTestExpiry: null, revenueLicenceExpiry: null, insuranceExpiry: null,
        intervalOverrides: Prisma.JsonNull, neverDoneConfirmed: Prisma.JsonNull,
      },
    })
  }

  await prisma.appNotification.deleteMany({ where: { userPhone: phoneNumber } })
  // Admin panel (2026-10-26): no relation/cascade from User (deliberately, to keep
  // the User model untouched - see UserActiveDay's own comment in schema.prisma),
  // so this needs an explicit delete here. Covers both the manual CLI script and the
  // 14-day sweep, since both call this same function.
  await prisma.userActiveDay.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { phoneNumber } })
}
