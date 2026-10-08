// Spec: 03-api.md §0 "Blocks (server enforced)". One row in MartBlock blocks both
// directions — call this for the current user and use the result to filter every feed,
// search, similar-ads, thread and profile query from day one (even though MartBlock is
// empty until Step 3.2 ships the UI — this is here now so every later query can use it
// without a second pass to add blocking later).
import { PrismaClient } from '@prisma/client'

export async function blockedSet(prisma: PrismaClient, myPhone: string): Promise<Set<string>> {
  const rows = await prisma.martBlock.findMany({
    where: { OR: [{ blockerPhone: myPhone }, { blockedPhone: myPhone }] },
    select: { blockerPhone: true, blockedPhone: true },
  })
  const set = new Set<string>()
  for (const r of rows) {
    set.add(r.blockerPhone === myPhone ? r.blockedPhone : r.blockerPhone)
  }
  return set
}
