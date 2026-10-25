import dotenv from 'dotenv'
import path from 'path'

// globalSetup.ts runs in its own process and can't pass env vars to the actual
// test workers - each worker needs to load .env.test itself. This file is
// Jest's `setupFiles` entry, which runs once per test file before anything else.
// override: true - see globalSetup.ts for why this is needed, not optional.
dotenv.config({ path: path.join(__dirname, '..', '.env.test'), override: true })
