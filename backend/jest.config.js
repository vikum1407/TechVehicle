/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // Main tsconfig.json only includes src/**/* (rootDir: ./src, used for the
  // production build) - it never sees tests/**/* or @types/jest, so Jest's
  // globals (describe/it/expect) don't resolve. This dedicated config covers
  // both without touching the production build's tsconfig at all.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  // Integration tests hit a real, remote (dedicated test, never production)
  // Neon database over the network - slower than pure unit tests, and Jest's
  // default 5s timeout is too tight. Some setup chains (e.g. a booking flow:
  // 2 logins + create vehicle/garage/booking/confirm) make 10+ sequential
  // network round-trips before the test body even starts, which can exceed
  // 15s under normal latency variance - bumped from 15000 after that was
  // observed to time out a genuinely-passing test, not a real hang. Bumped
  // again 2026-10-25 (30000 -> 45000) after the same class of flake recurred
  // on a different heavy-setup test as the suite grew - this is latency
  // variance against a real remote DB, not a logic bug, each time it's hit.
  testTimeout: 45000,
  // Route files each new up their own PrismaClient; many open connections at once
  // against one small test container can be flaky. Running test FILES serially
  // (not test cases within a file) keeps this predictable without slowing things
  // down much, since the suite is still small.
  maxWorkers: 1,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/app.ts',
    '!src/scripts/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
}
