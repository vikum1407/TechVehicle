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
import { blockedSet } from '../../utils/blockedSet'
import { getSellerTags, getSellerRatings } from '../../utils/sellerInfo'
import { publicName } from '../../utils/publicName'
import { encodeCursor, decodeCursor, clampLimit } from '../../utils/pagination'

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

// Spec: 03-api.md §4 GET /mart/listings. Exported as a pure function (no DB) so the
// filter/search logic is unit-testable without a live database. `blockedPhones` is
// passed in rather than queried here, so the caller controls when that query happens.
export function buildListingsWhere(query: any, blockedPhones: string[]): Prisma.MartListingWhereInput {
  const type = query?.type === 'wanted' ? 'wanted' : 'selling'
  const isSelling = type === 'selling'

  const and: Prisma.MartListingWhereInput[] = [
    { type },
    { status: { in: isSelling ? ['available', 'reserved'] : ['open'] } },
    { removedAt: null },
  ]
  if (blockedPhones.length > 0) and.push({ ownerPhone: { notIn: blockedPhones } })

  const q = typeof query?.q === 'string' ? query.q.trim() : ''
  if (q) {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6).map((w: string) => w.slice(0, 40).toLowerCase())
    for (const word of words) {
      const categoryIds = MART_CATEGORIES.filter(c =>
        c.en.toLowerCase().includes(word) || c.keywords.some(k => k.toLowerCase().includes(word))
      ).map(c => c.id)
      const or: Prisma.MartListingWhereInput[] = [
        { title: { contains: word, mode: 'insensitive' } },
        { description: { contains: word, mode: 'insensitive' } },
        { make: { contains: word, mode: 'insensitive' } },
        { model: { contains: word, mode: 'insensitive' } },
      ]
      if (categoryIds.length > 0) or.push({ categoryId: { in: categoryIds } })
      and.push({ OR: or })
    }
  }

  if (typeof query?.categoryId === 'string') and.push({ categoryId: query.categoryId })
  if (typeof query?.categoryTypeId === 'string') and.push({ categoryTypeId: query.categoryTypeId })

  if (typeof query?.make === 'string' && query.make) {
    const makeNorm = normalizeVehicleText(query.make)
    and.push({ OR: [{ makeNorm: null }, { makeNorm }] })
  }
  if (typeof query?.model === 'string' && query.model) {
    const modelNorm = normalizeVehicleText(query.model)
    and.push({ OR: [{ modelNorm: null }, { modelNorm }] })
  }

  let yFrom = query?.yearFrom !== undefined ? Number(query.yearFrom) : undefined
  let yTo = query?.yearTo !== undefined ? Number(query.yearTo) : undefined
  if (Number.isFinite(yFrom) && !Number.isFinite(yTo)) yTo = yFrom
  if (Number.isFinite(yTo) && !Number.isFinite(yFrom)) yFrom = yTo
  if (Number.isFinite(yFrom) && Number.isFinite(yTo)) {
    and.push({
      OR: [
        { AND: [{ yearFrom: null }, { yearTo: null }] },
        { AND: [{ yearFrom: { lte: yTo } }, { yearTo: { gte: yFrom } }] },
      ],
    })
  }

  if (isSelling && (query?.condition === 'new' || query?.condition === 'used')) {
    and.push({ condition: query.condition })
  }

  const priceMin = query?.priceMin !== undefined ? Number(query.priceMin) : undefined
  const priceMax = query?.priceMax !== undefined ? Number(query.priceMax) : undefined
  if (isSelling) {
    if (Number.isFinite(priceMin)) and.push({ price: { gte: priceMin } })
    if (Number.isFinite(priceMax)) and.push({ price: { lte: priceMax } })
  } else if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
    // Wanted budget overlap — not reachable from the app until Milestone 2 Step 2.1
    // (Wanted posting/feed), so this is a best-effort implementation of 03-api.md §4's
    // rule rather than one exercised by any real caller yet.
    and.push({
      OR: [
        { budgetMax: null },
        {
          AND: [
            Number.isFinite(priceMin) ? { budgetMax: { gte: priceMin } } : {},
            Number.isFinite(priceMax) ? { OR: [{ budgetMin: null }, { budgetMin: { lte: priceMax } }] } : {},
          ],
        },
      ],
    })
  }

  if (typeof query?.district === 'string' && query.district) and.push({ district: query.district })

  return { AND: and }
}

type SortMode = 'newest' | 'price_asc' | 'price_desc'

function parseSort(query: any): SortMode {
  return query?.sort === 'price_asc' || query?.sort === 'price_desc' ? query.sort : 'newest'
}

function applyCursor(where: Prisma.MartListingWhereInput, sort: SortMode, type: string, cursor: { t: string | number; id: string } | null): Prisma.MartListingWhereInput {
  if (!cursor) return where
  const and = Array.isArray((where as any).AND) ? [...(where as any).AND] : [where]
  if (sort === 'newest') {
    const t = new Date(cursor.t)
    and.push({ OR: [{ postedAt: { lt: t } }, { AND: [{ postedAt: t }, { id: { lt: cursor.id } }] }] })
  } else {
    const sortField = type === 'wanted' ? 'budgetMax' : 'price'
    const t = Number(cursor.t)
    const asc = sort === 'price_asc'
    and.push({
      OR: [
        { [sortField]: asc ? { gt: t } : { lt: t } } as any,
        { AND: [{ [sortField]: t } as any, { id: asc ? { gt: cursor.id } : { lt: cursor.id } }] },
      ],
    })
  }
  return { AND: and }
}

function orderBy(sort: SortMode, type: string): Prisma.MartListingOrderByWithRelationInput[] {
  if (sort === 'newest') return [{ postedAt: 'desc' }, { id: 'desc' }]
  const sortField = type === 'wanted' ? 'budgetMax' : 'price'
  const dir = sort === 'price_asc' ? 'asc' : 'desc'
  return [{ [sortField]: { sort: dir, nulls: 'last' } } as any, { id: dir }]
}

router.get('/', async (req: AuthRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q) {
    const limit = checkRateLimit('mart-search', req.phoneNumber!, MART_RATE_LIMITS.SEARCH.max, MART_RATE_LIMITS.SEARCH.windowMs)
    if (!limit.allowed) { res.status(429).json({ error: 'Too many tries. Please wait a few minutes.' }); return }
  }

  const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  const cursor = decodeCursor(cursorRaw)
  if (cursorRaw && !cursor) { res.status(400).json({ error: 'Invalid cursor', code: 'VALIDATION' }); return }

  const blocked = await blockedSet(prisma, req.phoneNumber!)
  const type = req.query.type === 'wanted' ? 'wanted' : 'selling'
  const sort = parseSort(req.query)
  const baseWhere = buildListingsWhere(req.query, [...blocked])
  const where = applyCursor(baseWhere, sort, type, cursor)
  const limitN = clampLimit(req.query.limit, MART_LIMITS.PAGE_SIZE, MART_LIMITS.PAGE_SIZE_MAX)

  const rows = await prisma.martListing.findMany({
    where, orderBy: orderBy(sort, type), take: limitN + 1,
  })
  const hasMore = rows.length > limitN
  const page = hasMore ? rows.slice(0, limitN) : rows

  if (q) {
    const term = q.toLowerCase()
    prisma.martSearchHistory.create({ data: { userPhone: req.phoneNumber!, term } })
      .then(async () => {
        const old = await prisma.martSearchHistory.findMany({
          where: { userPhone: req.phoneNumber! }, orderBy: { createdAt: 'desc' },
          skip: MART_LIMITS.SEARCH_HISTORY_MAX, select: { id: true },
        })
        if (old.length > 0) await prisma.martSearchHistory.deleteMany({ where: { id: { in: old.map(o => o.id) } } })
      })
      .catch(() => {})
  }

  const ownerPhones = [...new Set(page.map(r => r.ownerPhone))]
  const [users, tagMap, ratingMap, favoriteRows] = await Promise.all([
    prisma.user.findMany({ where: { phoneNumber: { in: ownerPhones } }, select: { id: true, phoneNumber: true, displayName: true } }),
    getSellerTags(prisma, ownerPhones),
    getSellerRatings(prisma, ownerPhones),
    prisma.martFavorite.findMany({ where: { userPhone: req.phoneNumber!, listingId: { in: page.map(r => r.id) } }, select: { listingId: true } }),
  ])
  const userByPhone = new Map(users.map(u => [u.phoneNumber, u]))
  const favoritedIds = new Set(favoriteRows.map(f => f.listingId))

  const items = page.map(listing => {
    const owner = userByPhone.get(listing.ownerPhone)
    const tag = tagMap.get(listing.ownerPhone) || 'casual'
    return {
      id: listing.id, type: listing.type,
      title: listing.title, coverUrl: listing.photoUrls[0] || null,
      price: listing.price, budgetMin: listing.budgetMin, budgetMax: listing.budgetMax,
      condition: listing.condition, district: listing.district,
      make: listing.make, model: listing.model,
      status: listing.status, postedAt: listing.postedAt.toISOString(),
      isFavorited: favoritedIds.has(listing.id),
      seller: {
        id: owner?.id || '', name: publicName(owner?.displayName, tag),
        tag, rating: ratingMap.get(listing.ownerPhone) || { avg: null, count: 0 },
      },
      yearFrom: listing.yearFrom, yearTo: listing.yearTo,
      categoryId: listing.categoryId,
      statusChangedAt: listing.statusChangedAt.toISOString(),
      closedAt: listing.closedAt ? listing.closedAt.toISOString() : null,
    }
  })

  const last = page[page.length - 1]
  const nextCursor = hasMore && last
    ? encodeCursor({ t: sort === 'newest' ? last.postedAt.toISOString() : (type === 'wanted' ? last.budgetMax ?? 0 : last.price ?? 0), id: last.id })
    : null

  res.json({ items, nextCursor })
})

// Registered before any future `/:listingId` (Step 1.4) so "count" is never swallowed
// as a listing id — Express matches routes in registration order.
router.get('/count', async (req: AuthRequest, res) => {
  const blocked = await blockedSet(prisma, req.phoneNumber!)
  const where = buildListingsWhere(req.query, [...blocked])
  const count = await prisma.martListing.count({ where })
  res.json({ count })
})

export default router
