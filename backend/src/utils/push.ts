import { PrismaClient } from '@prisma/client'

// Own client, matching the existing per-file convention elsewhere in the backend.
const prisma = new PrismaClient()

export async function sendPush(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({ to: pushToken, title, body, data: data || {} }),
    })

    // Expo returns { data: [ { status: 'ok' } ] } or
    // { data: [ { status: 'error', message, details: { error: 'DeviceNotRegistered' } } ] }
    // for a single-recipient send. If the device is gone, clear the dead token so we
    // stop retrying it forever.
    const json: any = await res.json().catch(() => null)
    const ticket = json?.data?.[0]
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      await prisma.user.updateMany({
        where: { pushToken },
        data: { pushToken: null },
      })
    }
  } catch (e) {
    console.error('Push send failed:', e)
  }
}
