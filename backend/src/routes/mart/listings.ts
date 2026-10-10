import express from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { AuthRequest } from '../../middleware/auth'
import { requireProfile } from '../../middleware/requireProfile'
import { requireRules } from '../../middleware/requireRules'
import { checkRateLimit } from '../../utils/rateLimit'
import { capText } from '../../utils/validate'
import { normalizeVehicleText } from '../../utils/vehicleText'
import { MART_CATEGORIES } from '../../data/martCategories'
import { DISTRICTS } from '../../data/districts'
import { BRAND_MODELS } from '../../data/vehicleCatalog'
import { MART_LIMITS, MART_RATE_LIMITS } from '../../data/martLimits'

const prisma = new PrismaClient()
const router = express.Router()

const CURRENT_YEAR = new Date().getFullYear()

export type ListingCreateInput = {
  type: string
  title: string
  description: string | null
  categoryId: string
  categoryTypeId: string | null
  condition: string | null
  make: string | null
  model: string | null
  makeNorm: string | null
  modelNorm: string | null
  yearFrom: number | null
  yearTo: number | null
  price: number | null
  budgetMin: number | null
  budgetMax: number | null
  district: string
  deliveryAvailable: boolean
  photoUrls: string[]
}

export type ListingValidationResult =
  | { ok: true; data: ListingCreateInput }
  | { ok: false; error: string; code: string }

// Spec: 02-data-model.md §4.1. Exported as a pure function (no DB, no req/res) so it can
// be unit-tested directly. `r2PublicUrl` is passed in rather than read from `process.env`
// here, so the same function works the same way in a test script.
export function validateListingCreate(body: any, r2PublicUrl: string): ListingValidationResult {
  const fail = (error: string, code = 'VALIDATION') => ({ ok: false as const, error, code })

  const type = body?.type
  if (type !== 'selling' && type !== 'wanted') return fail('Select Selling or Wanted')
  const isSelling = type === 'selling'

  const title = capText(body?.title ?? '', MART_LIMITS.TITLE_MAX).trim()
  if (title.length < 1) return fail('Enter a title')

  let description: string | null = null
  if (body?.description !== undefined && body?.description !== null) {
    const trimmed = capText(body.description, MART_LIMITS.DESCRIPTION_MAX).trim()
    description = trimmed.length > 0 ? trimmed : null
  }

  const category = MART_CATEGORIES.find(c => c.id === body?.categoryId)
  if (!category) return fail('Select a valid category')
  let categoryTypeId: string | null = null
  if (body?.categoryTypeId !== undefined && body?.categoryTypeId !== null) {
    const type_ = category.types.find(t => t.id === body.categoryTypeId)
    if (!type_) return fail('Select a valid type for this category')
    categoryTypeId = type_.id
  }

  let condition: string | null = null
  if (isSelling) {
    if (body?.condition !== 'new' && body?.condition !== 'used') return fail('Select New or Used')
    condition = body.condition
  }

  let make: string | null = null
  let model: string | null = null
  const rawMake = typeof body?.make === 'string' ? body.make.trim() : ''
  if (isSelling && !rawMake) return fail('Select a vehicle make')
  if (rawMake) {
    const isCatalogMake = Object.prototype.hasOwnProperty.call(BRAND_MODELS, rawMake)
    if (!isCatalogMake && rawMake !== 'Other') return fail('Select a valid make')
    make = rawMake
    const rawModel = typeof body?.model === 'string' ? body.model.trim() : ''
    if (rawModel) {
      if (isCatalogMake && rawModel !== 'Other') {
        if (!BRAND_MODELS[rawMake].includes(rawModel)) return fail('Select a valid model')
        model = rawModel
      } else {
        model = capText(rawModel, 40)
      }
    }
  }

  let yearFrom: number | null = null
  let yearTo: number | null = null
  const hasFrom = body?.yearFrom !== undefined && body?.yearFrom !== null
  const hasTo = body?.yearTo !== undefined && body?.yearTo !== null
  if (hasFrom !== hasTo) return fail('Give both year from and year to, or neither')
  if (hasFrom && hasTo) {
    const f = Number(body.yearFrom)
    const t = Number(body.yearTo)
    const minYear = MART_LIMITS.YEAR_MIN
    const maxYear = CURRENT_YEAR + 1
    if (!Number.isInteger(f) || f < minYear || f > maxYear) return fail('Invalid "year from"')
    if (!Number.isInteger(t) || t < minYear || t > maxYear) return fail('Invalid "year to"')
    if (f > t) return fail('"Year from" must not be after "year to"')
    yearFrom = f
    yearTo = t
  }

  let price: number | null = null
  let budgetMin: number | null = null
  let budgetMax: number | null = null
  if (isSelling) {
    const p = Number(body?.price)
    if (!Number.isInteger(p) || p < 1 || p > MART_LIMITS.PRICE_MAX) return fail('Enter a valid price')
    price = p
  } else {
    const hasMax = body?.budgetMax !== undefined && body?.budgetMax !== null
    const hasMin = body?.budgetMin !== undefined && body?.budgetMin !== null
    if (hasMin && !hasMax) return fail('A maximum budget is required if you give a minimum')
    if (hasMax) {
      const max = Number(body.budgetMax)
      if (!Number.isInteger(max) || max < 1 || max > MART_LIMITS.PRICE_MAX) return fail('Enter a valid budget')
      budgetMax = max
      if (hasMin) {
        const min = Number(body.budgetMin)
        if (!Number.isInteger(min) || min < 1 || min > max) return fail('Minimum budget must not be above the maximum')
        budgetMin = min
      }
    }
  }

  const district = DISTRICTS.find(d => d.id === body?.district)
  if (!district) return fail('Select a valid district')

  const deliveryAvailable = isSelling ? !!body?.deliveryAvailable : false

  const photoUrls: string[] = Array.isArray(body?.photoUrls) ? body.photoUrls.filter((u: unknown) => typeof u === 'string') : []
  const maxPhotos = isSelling ? MART_LIMITS.PHOTOS_SELLING_MAX : MART_LIMITS.PHOTOS_WANTED_MAX
  const minPhotos = isSelling ? 1 : 0
  if (photoUrls.length < minPhotos || photoUrls.length > maxPhotos) return fail(`Add ${minPhotos > 0 ? 'at least 1 photo' : `up to ${maxPhotos} photos`}`)
  const prefix = `${r2PublicUrl}/mart-photos/`
  if (photoUrls.some(u => !u.startsWith(prefix))) return fail('Invalid photo')

  return {
    ok: true,
    data: {
      type, title, description, categoryId: category.id, categoryTypeId, condition,
      make, model, makeNorm: normalizeVehicleText(make), modelNorm: normalizeVehicleText(model),
      yearFrom, yearTo, price, budgetMin, budgetMax,
      district: district.id, deliveryAvailable, photoUrls,
    },
  }
}

router.post('/', requireProfile, requireRules, async (req: AuthRequest, res) => {
  const limit = checkRateLimit('mart-post', req.phoneNumber!, MART_RATE_LIMITS.POST_LISTING.max, MART_RATE_LIMITS.POST_LISTING.windowMs)
  if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }

  const result = validateListingCreate(req.body, process.env.R2_PUBLIC_URL || '')
  if (!result.ok) { res.status(400).json({ error: result.error, code: result.code }); return }

  const listing = await prisma.martListing.create({
    data: { ...result.data, ownerPhone: req.phoneNumber! } satisfies Prisma.MartListingUncheckedCreateInput,
  })

  res.status(201).json({ id: listing.id })
  // Wanted match alerts (02-data-model.md §7.3) run here once Milestone 2 Step 2.1 adds
  // real Wanted posting from the app — no caller can reach type:"wanted" yet, so there's
  // nothing to wire up before then.
})

export default router
