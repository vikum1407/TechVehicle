// Nothing to tear down - the test database is a persistent (but dedicated,
// test-only) Neon branch, not a throwaway container. globalSetup truncates
// all tables at the start of the next run instead, so the only cleanup needed
// is here for symmetry/future use (e.g. closing a shared connection pool).
export default async function globalTeardown() {}
