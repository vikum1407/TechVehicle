import { PrismaClient } from '@prisma/client'

export async function createNotification(
  prisma: PrismaClient,
  userPhone: string,
  type: string,
  title: string,
  body: string,
  linkTo?: object
) {
  try {
    await prisma.appNotification.create({
      data: {
        userPhone,
        type,
        title,
        body,
        linkTo: linkTo ? JSON.stringify(linkTo) : null,
      },
    })
  } catch {
    // non-fatal — notifications must never block the main operation
  }
}
