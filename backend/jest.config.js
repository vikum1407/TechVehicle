/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  // Integration tests hit a real (local, throwaway) Postgres over the network -
  // slower than pure unit tests, and Jest's default 5s timeout is too tight.
  testTimeout: 15000,
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
