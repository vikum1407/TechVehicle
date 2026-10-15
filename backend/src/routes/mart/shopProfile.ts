import express from 'express'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { capText } from '../../utils/validate'
import { DISTRICTS } from '../../data/districts'
import { MART_LIMITS } from '../../data/martLimits'
import { getSellerTags } from '../../utils/sellerInfo'

const prisma = new PrismaClient()
const router = express.Router()

// Spec: 03-api.md §0 endpoint index — auth only (no requireProfile/requireRules; those
// are listed explicitly where they apply, e.g. POST /mart/listings "rules+profile",
// and shop-profile isn't one of them).

function toProfileDTO(row: { name: string; logoUrl: string | null; about: string | null; contactPhone: string; district: string; townAddress: string | null; websiteUrl: string | null; googleMapsUrl: string | null }) {
  const { name, logoUrl, about, contactPhone, district, townAddress, websiteUrl, googleMapsUrl } = row
  return { name, logoUrl, about, contactPhone, district, townAddress, websiteUrl, googleMapsUrl }
}

// 02-data-model.md §4.4: "map the Garage's district/town text to a DISTRICTS id by
// normalized name; no match -> null". Garage has no district id of its own, only free
// text (town/village), so this is a best-effort case-insensitive name match.
function matchDistrict(text: string | null | undefined): string | null {
  if (!text) return null
  const norm = text.trim().toLowerCase()
  const found = DISTRICTS.find(d => d.en.toLowerCase() === norm)
  return found ? found.id : null
}

router.get('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const tagMap = await getSellerTags(prisma, [me])
  const eligible = tagMap.get(me) === 'shop'

  const existing = await prisma.martShopProfile.findUnique({ where: { ownerPhone: me } })
  if (!eligible) { res.json({ eligible: false, profile: null, prefill: null }); return }
  if (existing) { res.json({ eligible: true, profile: toProfileDTO(existing), prefill: null }); return }

  const garage = await prisma.garage.findUnique({ where: { ownerPhone: me } })
  const prefill = garage ? {
    name: garage.name,
    contactPhone: garage.contactPhone || null,
    district: matchDistrict(garage.town) || matchDistrict(garage.village),
    townAddress: garage.town || garage.village || null,
    websiteUrl: garage.websiteUrl || null,
    googleMapsUrl: garage.googleMapsUrl || null,
    about: garage.aboutBio || null,
  } : null

  res.json({ eligible: true, profile: null, prefill })
})

// Spec: 02-data-model.md §4.4. websiteUrl/googleMapsUrl: parse as a URL after
// prefixing https:// when missing; scheme must be http/https (reject javascript:,
// tel:, etc. — these are free-text fields a user can type anything into).
function normalizeUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

router.put('/', async (req: AuthRequest, res) => {
  const me = req.phoneNumber!
  const tagMap = await getSellerTags(prisma, [me])
  if (tagMap.get(me) !== 'shop') { res.status(403).json({ error: 'Only Shop sellers can save a shop profile', code: 'NOT_A_SHOP' }); return }

  const body = req.body || {}
  const name = capText(typeof body.name === 'string' ? body.name : '', MART_LIMITS.SHOP_NAME_MAX).trim()
  if (name.length < 1) { res.status(400).json({ error: 'Enter a shop name', code: 'VALIDATION' }); return }

  // Local Sri Lankan format (e.g. "0773574828"), not E.164 — same as Garage.contactPhone
  // (garages.ts), which this field mirrors. `isValidPhone`/`utils/phone.ts` is for the
  // User.phoneNumber identity field (+94 international format) and doesn't apply here.
  const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : ''
  if (!contactPhone || !/^0?7\d{8}$/.test(contactPhone.replace(/[\s-]/g, ''))) { res.status(400).json({ error: 'Enter a valid phone number', code: 'VALIDATION' }); return }

  const district = DISTRICTS.find(d => d.id === body.district)
  if (!district) { res.status(400).json({ error: 'Select a valid district', code: 'VALIDATION' }); return }

  let about: string | null = null
  if (body.about !== undefined && body.about !== null) {
    const trimmed = capText(body.about, MART_LIMITS.SHOP_ABOUT_MAX).trim()
    about = trimmed.length > 0 ? trimmed : null
  }
  let townAddress: string | null = null
  if (body.townAddress !== undefined && body.townAddress !== null) {
    const trimmed = capText(body.townAddress, MART_LIMITS.SHOP_ADDRESS_MAX).trim()
    townAddress = trimmed.length > 0 ? trimmed : null
  }

  let websiteUrl: string | null = null
  if (body.websiteUrl !== undefined && body.websiteUrl !== null && body.websiteUrl !== '') {
    websiteUrl = normalizeUrl(String(body.websiteUrl))
    if (!websiteUrl) { res.status(400).json({ error: 'Enter a valid website URL', code: 'VALIDATION' }); return }
  }
  let googleMapsUrl: string | null = null
  if (body.googleMapsUrl !== undefined && body.googleMapsUrl !== null && body.googleMapsUrl !== '') {
    googleMapsUrl = normalizeUrl(String(body.googleMapsUrl))
    if (!googleMapsUrl) { res.status(400).json({ error: 'Enter a valid Google Maps link', code: 'VALIDATION' }); return }
  }

  let logoUrl: string | null = null
  if (body.logoUrl !== undefined && body.logoUrl !== null && body.logoUrl !== '') {
    const prefix = `${process.env.R2_PUBLIC_URL || ''}/mart-photos/`
    if (typeof body.logoUrl !== 'string' || !body.logoUrl.startsWith(prefix)) {
      res.status(400).json({ error: 'Invalid logo photo', code: 'VALIDATION' }); return
    }
    logoUrl = body.logoUrl
  }

  const saved = await prisma.martShopProfile.upsert({
    where: { ownerPhone: me },
    create: { ownerPhone: me, name, logoUrl, about, contactPhone, district: district.id, townAddress, websiteUrl, googleMapsUrl },
    update: { name, logoUrl, about, contactPhone, district: district.id, townAddress, websiteUrl, googleMapsUrl },
  })

  res.json(toProfileDTO(saved))
})

export default router
