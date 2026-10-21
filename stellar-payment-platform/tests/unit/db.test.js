'use strict';

/**
 * tests/unit/db.test.js
 *
 * Unit test for the DATABASE_URL pre-flight check added by issue #270.
 *
 * src/db.js throws a clear Error (and logs at error level) when DATABASE_URL
 * is absent, instead of letting pg/Prisma surface an opaque internal stack
 * trace. These tests verify that contract without touching a real database.
 */

describe('src/db.js DATABASE_URL pre-flight check', () => {
  // Capture the original value so we can restore it after each test.
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    // Restore the environment variable and clear the module registry so the
    // next require() of db.js re-runs module-level code.
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    jest.resetModules();
  });

  it('throws a clear Error when DATABASE_URL is not set', () => {
    delete process.env.DATABASE_URL;

    expect(() => {
      require('../../src/db');
    }).toThrow('DATABASE_URL is not set');
  });

  it('error message tells the developer to check the README', () => {
    delete process.env.DATABASE_URL;

    let thrownMessage = '';
    try {
      require('../../src/db');
    } catch (err) {
      thrownMessage = err.message;
    }

    expect(thrownMessage).toMatch(/see README for database setup/i);
  });

  it('error message mentions .env.example', () => {
    delete process.env.DATABASE_URL;

    let thrownMessage = '';
    try {
      require('../../src/db');
    } catch (err) {
      thrownMessage = err.message;
    }

    // Guides the developer to copy .env.example → .env, which is the first
    // step documented in the README "Getting started" section.
    expect(thrownMessage).toMatch(/\.env\.example/);
  });

  it('does NOT throw when DATABASE_URL is present', () => {
    // Point at a syntactically valid but unreachable URL so pg does not try
    // to connect at module load time.
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

    // jest.resetModules() in afterEach ensures a fresh require here.
    // We only care that the module loads without throwing.
    expect(() => {
      require('../../src/db');
    }).not.toThrow();
  });
});
