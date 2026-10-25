import { execSync } from 'child_process'
import path from 'path'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Runs once before the whole test suite (Jest's globalSetup, separate process
// from the test files themselves). DATABASE_URL here must point at a dedicated,
// free Neon branch/project used ONLY for tests - never production. See .env.test.
export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '..', '.env.test') })

  // This script TRUNCATEs every table below - running it against the real
  // production database would destroy real user data. "Looks like Neon" alone
  // doesn't prove it's the TEST database (production is Neon too), so this
  // requires the database name itself to contain "test" as a mechanical
  // safeguard, not just a naming convention someone has to remember to follow.
  const dbUrl = process.env.DATABASE_URL || ''
  const dbNameMatch = dbUrl.match(/\/([^/?]+)(\?|$)/)
  const dbName = dbNameMatch?.[1] ?? ''
  if (!dbUrl.includes('neon.tech') || !dbName.toLowerCase().includes('test')) {
    throw new Error(
      '.env.test DATABASE_URL is missing, not a Neon connection string, or its database ' +
      `name ("${dbName}") doesn't contain "test". Refusing to run - this script truncates ` +
      'every table and running it against the wrong database would destroy real data. ' +
      'Create a dedicated Neon branch/project with "test" in its database name and use that.'
    )
  }

  const cwd = path.join(__dirname, '..')

  console.log('\n[tests] Pushing Prisma schema to the test database...')
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  })

  // The test Neon branch persists between runs (unlike a throwaway Docker
  // container), so clear all app tables before each suite run for a clean
  // slate - this is a dedicated test-only database, never production.
  console.log('[tests] Clearing test database tables...')
  const prisma = new PrismaClient()
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  if (tables.length > 0) {
    const names = tables.map(t => `"public"."${t.tablename}"`).join(', ')
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`)
  }
  await prisma.$disconnect()

  console.log('[tests] Test database ready.\n')
}
