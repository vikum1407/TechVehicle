import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { computePredictions } from '../utils/predictionEngine'
import { sendPush } from '../utils/push'
import { createNotification } from '../utils/appNotifications'
import { capText, isSafeUrl, SHORT_TEXT_LEN, LONG_TEXT_LEN } from '../utils/validate'

const router = express.Router()
const prisma = new PrismaClient()

router.use(authMiddleware)

// Sri Lankan addresses are commonly given as lane/house number, village, town —
// composed here into a single display string so every screen that already
// shows `garage.address` keeps working unchanged.
function composeAddress(addressLine?: string | null, village?: string | null, town?: string | null): string | null {
  const parts = [addressLine, village, town].map(p => p?.trim()).filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join(', ') : null
}

// GET /garages/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({
      where: { ownerPhone: req.phoneNumber! },
    })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }
    const ratingStats = await getRatingStats(garage.id)
    res.json({ ...garage, ...ratingStats })
  } catch (error) {
    console.error('GET /garages/me error:', error)
    res.status(500).json({ error: 'Failed to fetch garage' })
  }
})

// POST /garages/register
router.post('/register', async (req: AuthRequest, res) => {
  const { name, address, addressLine, village, town, brNumber } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Garage name is required' }); return
  }
  // Structured address (addressLine/village/town) is the current form; a caller on
  // an older app build that only ever sends a bare `address` string must still be
  // able to register without ever having heard of village/town.
  const hasStructuredAddress = addressLine !== undefined || village !== undefined || town !== undefined
  if (hasStructuredAddress && (!village?.trim() || !town?.trim())) {
    res.status(400).json({ error: 'Village and town are required' }); return
  }
  try {
    const existing = await prisma.garage.findUnique({
      where: { ownerPhone: req.phoneNumber! },
    })
    if (existing) { res.status(409).json({ error: 'You already have a registered garage' }); return }

    const garage = await prisma.garage.create({
      data: {
        ownerPhone: req.phoneNumber!,
        name: capText(name.trim(), SHORT_TEXT_LEN),
        ...(hasStructuredAddress
          ? {
              addressLine: addressLine?.trim() ? capText(addressLine, SHORT_TEXT_LEN) : null,
              village: village?.trim() ? capText(village, SHORT_TEXT_LEN) : null,
              town: town?.trim() ? capText(town, SHORT_TEXT_LEN) : null,
              address: composeAddress(addressLine, village, town),
            }
          : { address: address?.trim() ? capText(address, LONG_TEXT_LEN) : null }),
        brNumber: brNumber?.trim() ? capText(brNumber, SHORT_TEXT_LEN) : null,
        verified: false,
      },
    })
    res.status(201).json(garage)
  } catch (error) {
    console.error('POST /garages/register error:', error)
    res.status(500).json({ error: 'Failed to register garage' })
  }
})

// PUT /garages/me
router.put('/me', async (req: AuthRequest, res) => {
  const {
    name, address, addressLine, village, town, brNumber, priceList,
    photos, aboutBio, services, contactPhone, promoText, websiteUrl, googleMapsUrl,
  } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'Garage name is required' }); return
  }
  // Structured address (addressLine/village/town) is the current form; a bare
  // `address` string is kept accepted for any older caller still sending it.
  const hasStructuredAddress = addressLine !== undefined || village !== undefined || town !== undefined
  if (hasStructuredAddress && (!village?.trim() || !town?.trim())) {
    res.status(400).json({ error: 'Village and town are required' }); return
  }
  if (priceList !== undefined && priceList !== null) {
    if (!Array.isArray(priceList) || priceList.length > 200) {
      res.status(400).json({ error: 'priceList must be an array of at most 200 items' }); return
    }
    if (!priceList.every((item: unknown) => typeof item === 'object' && item !== null && JSON.stringify(item).length <= 500)) {
      res.status(400).json({ error: 'Each price list item must be an object under 500 characters' }); return
    }
  }
  if (photos !== undefined && photos !== null) {
    if (!Array.isArray(photos) || photos.length > 10) {
      res.status(400).json({ error: 'photos must be an array of at most 10 items' }); return
    }
    if (!photos.every((p: unknown) => typeof p === 'string' && p.length <= 2048)) {
      res.status(400).json({ error: 'Each photo must be a URL under 2048 characters' }); return
    }
  }
  if (services !== undefined && services !== null) {
    if (!Array.isArray(services) || services.length > 20) {
      res.status(400).json({ error: 'services must be an array of at most 20 items' }); return
    }
    if (!services.every((sItem: unknown) => typeof sItem === 'string' && sItem.length <= SHORT_TEXT_LEN)) {
      res.status(400).json({ error: `Each service tag must be under ${SHORT_TEXT_LEN} characters` }); return
    }
  }
  if (contactPhone?.trim() && !/^0?7\d{8}$/.test(String(contactPhone).replace(/[\s-]/g, ''))) {
    res.status(400).json({ error: 'Contact phone must be a valid Sri Lankan mobile number, e.g. 077 123 4567' }); return
  }
  if (websiteUrl !== undefined && !isSafeUrl(websiteUrl)) {
    res.status(400).json({ error: 'Website URL must be a valid http(s) link' }); return
  }
  if (googleMapsUrl !== undefined && !isSafeUrl(googleMapsUrl)) {
    res.status(400).json({ error: 'Google Maps URL must be a valid http(s) link' }); return
  }
  try {
    const garage = await prisma.garage.update({
      where: { ownerPhone: req.phoneNumber! },
      data: {
        name: capText(name.trim(), SHORT_TEXT_LEN),
        ...(hasStructuredAddress
          ? {
              addressLine: addressLine?.trim() ? capText(addressLine, SHORT_TEXT_LEN) : null,
              village: village?.trim() ? capText(village, SHORT_TEXT_LEN) : null,
              town: town?.trim() ? capText(town, SHORT_TEXT_LEN) : null,
              address: composeAddress(addressLine, village, town),
            }
          : (address !== undefined ? { address: address?.trim() ? capText(address, LONG_TEXT_LEN) : null } : {})),
        brNumber: brNumber?.trim() ? capText(brNumber, SHORT_TEXT_LEN) : null,
        ...(priceList !== undefined
          ? { priceList: Array.isArray(priceList) ? priceList : Prisma.JsonNull }
          : {}),
        ...(photos !== undefined && { photos: Array.isArray(photos) ? photos.map((p: string) => p.trim()) : [] }),
        ...(services !== undefined && { services: Array.isArray(services) ? services.map((sItem: string) => capText(sItem, SHORT_TEXT_LEN)) : [] }),
        ...(aboutBio !== undefined && { aboutBio: aboutBio?.trim() ? capText(aboutBio, 500) : null }),
        ...(contactPhone !== undefined && { contactPhone: contactPhone?.trim() ? capText(contactPhone, SHORT_TEXT_LEN) : null }),
        ...(promoText !== undefined && { promoText: promoText?.trim() ? capText(promoText, SHORT_TEXT_LEN) : null }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl?.trim() ? capText(websiteUrl, 500) : null }),
        ...(googleMapsUrl !== undefined && { googleMapsUrl: googleMapsUrl?.trim() ? capText(googleMapsUrl, 500) : null }),
      },
    })
    res.json(garage)
  } catch (error) {
    console.error('PUT /garages/me error:', error)
    res.status(500).json({ error: 'Failed to update garage' })
  }
})

// GET /garages/search?name=xxx — search garages by name, village, or town (public-ish,
// still requires auth). The query still arrives as `name` for backward compatibility
// with existing mobile callers, but now matches any of the three fields.
// Omit or leave blank to return all garages.
router.get('/search', async (req: AuthRequest, res) => {
  const query = (req.query.name as string || '').trim()
  try {
    const garages = await prisma.garage.findMany({
      where: query.length >= 2
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { village: { contains: query, mode: 'insensitive' } },
              { town: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true, name: true, address: true, verified: true, priceList: true,
        photos: true, aboutBio: true, services: true, contactPhone: true, promoText: true, websiteUrl: true, googleMapsUrl: true,
      },
      take: 50,
      orderBy: { verified: 'desc' },
    })
    const withRatings = await Promise.all(garages.map(async g => ({ ...g, ...(await getRatingStats(g.id)) })))
    res.json(withRatings)
  } catch (error) {
    console.error('GET /garages/search error:', error)
    res.status(500).json({ error: 'Failed to search garages' })
  }
})

// GET /garages/customers — vehicles this garage has an established relationship with
// (an accepted service submission, or a confirmed/completed booking), plus prediction status
router.get('/customers', async (req: AuthRequest, res) => {
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }

    const acceptedGroups = await prisma.serviceSubmission.groupBy({
      by: ['vehicleId'],
      where: { garageId: garage.id, status: 'accepted' },
      _count: { id: true },
      _sum: { cost: true },
      _max: { createdAt: true },
    })
    const bookingVehicles = await prisma.booking.findMany({
      where: { garageId: garage.id, status: { in: ['confirmed', 'completed'] } },
      select: { vehicleId: true },
      distinct: ['vehicleId'],
    })

    const vehicleIds = Array.from(new Set([
      ...acceptedGroups.map(g => g.vehicleId),
      ...bookingVehicles.map(b => b.vehicleId),
    ]))
    if (vehicleIds.length === 0) { res.json([]); return }

    const vehicles = await prisma.vehicle.findMany({ where: { id: { in: vehicleIds } } })
    const reminders = await prisma.garageReminder.findMany({
      where: { garageId: garage.id, vehicleId: { in: vehicleIds } },
    })
    const reminderMap = new Map(reminders.map(r => [r.vehicleId, r.sentAt]))
    const groupMap = new Map(acceptedGroups.map(g => [g.vehicleId, g]))

    const customers = []
    for (const vehicle of vehicles) {
      const group = groupMap.get(vehicle.id)
      const records = await prisma.serviceRecord.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { date: 'desc' },
      })
      const predictions = computePredictions(vehicle as any, records)
      const top = predictions.find(p => p.status === 'overdue') || predictions.find(p => p.status === 'due_soon')

      customers.push({
        vehicleId: vehicle.id,
        registrationNo: vehicle.registrationNo,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        vehicleType: vehicle.vehicleType ?? null,
        jobCount: group?._count.id ?? 0,
        totalRevenue: group?._sum.cost ?? 0,
        lastServiceDate: group?._max.createdAt ?? null,
        prediction: top ? { name: top.name, status: top.status, remainingKm: top.remainingKm, remainingDays: top.remainingDays } : null,
        lastReminderSentAt: reminderMap.get(vehicle.id) ?? null,
      })
    }

    customers.sort((a, b) => {
      const rank = (s?: string) => s === 'overdue' ? 0 : s === 'due_soon' ? 1 : 2
      return rank(a.prediction?.status) - rank(b.prediction?.status)
    })

    res.json(customers)
  } catch (error) {
    console.error('GET /garages/customers error:', error)
    res.status(500).json({ error: 'Failed to fetch customers' })
  }
})

// GET /garages/customers/:vehicleId/history — itemized ledger of every accepted job this garage has
// logged for this specific vehicle (the digital version of a garage's own customer record book)
router.get('/customers/:vehicleId/history', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }

    const hasSubmission = await prisma.serviceSubmission.findFirst({
      where: { garageId: garage.id, vehicleId, status: 'accepted' },
    })
    const hasBooking = hasSubmission ? null : await prisma.booking.findFirst({
      where: { garageId: garage.id, vehicleId, status: { in: ['confirmed', 'completed'] } },
    })
    if (!hasSubmission && !hasBooking) { res.status(404).json({ error: 'Not a customer of this garage' }); return }

    const history = await prisma.serviceSubmission.findMany({
      where: { garageId: garage.id, vehicleId, status: 'accepted' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, description: true, categories: true, cost: true, mileage: true, notes: true, photos: true, createdAt: true },
    })
    res.json(history)
  } catch (error) {
    console.error('GET /garages/customers/:vehicleId/history error:', error)
    res.status(500).json({ error: 'Failed to fetch customer history' })
  }
})

// POST /garages/customers/:vehicleId/remind — nudge an owner that their vehicle looks due for service
router.post('/customers/:vehicleId/remind', async (req: AuthRequest, res) => {
  const vehicleId = req.params.vehicleId as string
  try {
    const garage = await prisma.garage.findUnique({ where: { ownerPhone: req.phoneNumber! } })
    if (!garage) { res.status(404).json({ error: 'No garage registered' }); return }

    const hasSubmission = await prisma.serviceSubmission.findFirst({
      where: { garageId: garage.id, vehicleId, status: 'accepted' },
    })
    const hasBooking = hasSubmission ? null : await prisma.booking.findFirst({
      where: { garageId: garage.id, vehicleId, status: { in: ['confirmed', 'completed'] } },
    })
    if (!hasSubmission && !hasBooking) { res.status(404).json({ error: 'Not a customer of this garage' }); return }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle) { res.status(404).json({ error: 'Vehicle not found' }); return }

    const existingReminder = await prisma.garageReminder.findUnique({
      where: { garageId_vehicleId: { garageId: garage.id, vehicleId } },
    })
    if (existingReminder) {
      const daysSince = (Date.now() - existingReminder.sentAt.getTime()) / 86400000
      if (daysSince < 7) {
        res.status(429).json({ error: `You can remind this customer again in ${Math.ceil(7 - daysSince)} day(s)` })
        return
      }
    }

    const records = await prisma.serviceRecord.findMany({ where: { vehicleId }, orderBy: { date: 'desc' } })
    const predictions = computePredictions(vehicle as any, records)
    const top = predictions.find(p => p.status === 'overdue') || predictions.find(p => p.status === 'due_soon')
    if (!top) { res.status(400).json({ error: 'No due or overdue service to remind about right now' }); return }

    await prisma.garageReminder.upsert({
      where: { garageId_vehicleId: { garageId: garage.id, vehicleId } },
      update: { sentAt: new Date() },
      create: { garageId: garage.id, vehicleId },
    })

    const owner = await prisma.user.findUnique({ where: { phoneNumber: vehicle.ownerPhone } })
    const prefs = parsePrefs(owner?.notificationPrefs)
    const title = `${garage.name} — Service Reminder`
    const body = `${vehicle.registrationNo}: ${top.name} looks ${top.status === 'overdue' ? 'overdue' : 'due soon'}. Tap to book a service.`
    if (prefs.garage_reminder) {
      await sendPush(owner?.pushToken, title, body, { screen: 'vehicleDashboard', vehicleId })
    }
    await createNotification(prisma, vehicle.ownerPhone, 'garage_reminder', title, body, {
      screen: 'vehicleDashboard', vehicleId,
    })

    res.json({ success: true })
  } catch (error) {
    console.error('POST /garages/customers/:vehicleId/remind error:', error)
    res.status(500).json({ error: 'Failed to send reminder' })
  }
})

// GET /garages/:id/ratings — star distribution + written reviews for a garage
router.get('/:id/ratings', async (req: AuthRequest, res) => {
  const garageId = req.params.id as string
  try {
    const [distGroups, reviews, stats] = await Promise.all([
      prisma.garageRating.groupBy({ by: ['rating'], where: { garageId }, _count: { rating: true } }),
      prisma.garageRating.findMany({
        where: { garageId, comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 30,
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
    where: { garageId },
    _avg: { rating: true },
    _count: { rating: true },
  })
  return {
    avgRating: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
    ratingCount: agg._count.rating,
  }
}

function parsePrefs(raw: string | null | undefined): Record<string, boolean> {
  const defaults = { service_due: true, mileage_reminder: true, renewal: true, insurance_reminder: true, booking: true, transfer: true, submission: true, garage_reminder: true }
  if (!raw) return defaults
  try { return { ...defaults, ...JSON.parse(raw) } } catch { return defaults }
}

export default router
