import { PrismaClient } from '@prisma/client'

// Spec: 02-data-model.md §4.6 "both participants must have sent at least one message
// (text or offer; the seller's offer counts as the seller's message)". Needed by both
// listings.ts (POST /rate, GET /buyers, GET /:listingId's deal.canRate) and threads.ts
// (GET /:threadId's canRate/dealBanner) — lives here, not in either file, since listings.ts
// already imports from threads.ts and a reverse import would be circular.
export async function threadCanRate(prisma: PrismaClient, threadId: string, ownerPhone: string, otherPhone: string): Promise<boolean> {
  const [ownerMsg, otherMsg] = await Promise.all([
    prisma.martMessage.findFirst({ where: { threadId, senderPhone: ownerPhone, kind: { in: ['text', 'offer'] } } }),
    prisma.martMessage.findFirst({ where: { threadId, senderPhone: otherPhone, kind: { in: ['text', 'offer'] } } }),
  ])
  return !!ownerMsg && !!otherMsg
}
