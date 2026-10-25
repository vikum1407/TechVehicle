import { PrismaClient } from '@prisma/client'
import { hardDeleteAccount } from '../utils/accountDeletion'

const prisma = new PrismaClient()

// Exported so tests can call the actual check logic directly, without going
// through startAccountDeletionJob() (which would also start a real setInterval).
export async function checkAccountDeletions() {
  const due = await prisma.user.findMany({
    where: { pendingDeletionAt: { lte: new Date() } },
    select: { phoneNumber: true },
  })
  for (const { phoneNumber } of due) {
    try {
      await hardDeleteAccount(prisma, phoneNumber)
      console.log(`Account deletion: hard-deleted ${phoneNumber} (grace period elapsed)`)
    } catch (e) {
      console.error(`Account deletion: failed to hard-delete ${phoneNumber}:`, e)
    }
  }
}

export function startAccountDeletionJob() {
  // Run once on startup, then daily - 14-day granularity makes a daily sweep plenty.
  checkAccountDeletions().catch(e => console.error('Account deletion sweep error:', e))
  setInterval(() => {
    checkAccountDeletions().catch(e => console.error('Account deletion sweep error:', e))
  }, 24 * 60 * 60 * 1000)
  console.log('Account deletion sweep job started (runs daily)')
}
