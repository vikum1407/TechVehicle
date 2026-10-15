import { PrismaClient } from '@prisma/client'

// Spec: 04-screens.md §15 "Seller public profile (section 16) and Detail seller row
// show the logo, name and Shop tag from here [MartShopProfile]." Batched the same way
// as getSellerTags/getSellerRatings in sellerInfo.ts — one query per page, used by both
// buildListingCards (listings.ts) and resolveOtherInfo (threads.ts) wherever a seller's
// display name/photo is built, so a Shop's chosen business identity shows consistently
// everywhere instead of their personal displayName/profilePhotoUrl.
export async function getShopProfiles(
  prisma: PrismaClient,
  phones: string[]
): Promise<Map<string, { name: string; logoUrl: string | null }>> {
  const result = new Map<string, { name: string; logoUrl: string | null }>()
  const uniquePhones = [...new Set(phones)]
  if (uniquePhones.length === 0) return result

  const rows = await prisma.martShopProfile.findMany({
    where: { ownerPhone: { in: uniquePhones } },
    select: { ownerPhone: true, name: true, logoUrl: true },
  })
  for (const r of rows) result.set(r.ownerPhone, { name: r.name, logoUrl: r.logoUrl })
  return result
}
