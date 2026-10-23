import { PrismaClient } from '@prisma/client'

// Temporary promo/referral campaign (2026-10-23) - see schema.prisma's User.promoCode
// comment for the full removal plan. Excludes visually-ambiguous characters
// (0/O, 1/I/L) since codes get read aloud / typed from a photo/screenshot.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

function randomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

// Idempotent - returns the existing code if this user already has one, otherwise
// generates and saves a new one (retrying on the rare collision).
export async function ensurePromoCode(prisma: PrismaClient, phoneNumber: string, existingCode?: string | null): Promise<string> {
  if (existingCode) return existingCode
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.user.update({
        where: { phoneNumber },
        data: { promoCode: randomCode() },
      })
      return (updated as any).promoCode as string
    } catch (error: any) {
      if (error.code === 'P2002') continue // code collision, try again
      throw error
    }
  }
  throw new Error('Failed to generate a unique promo code after 5 attempts')
}
