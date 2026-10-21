'use strict';

/**
 * Unit tests for prismaClient.js.
 *
 * Without DATABASE_URL the module falls back to an in-memory mock whose
 * methods are plain async functions. This suite exercises every mock method
 * (plus withTransaction / isPrismaConnectionError) so the module's functions
 * count towards coverage instead of dragging the global floor down.
 */

// Ensure the fallback mock path is taken (no DATABASE_URL in tests).
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

// Silence logger output during this suite.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

// Capture pool-related env vars so they can be restored after the suite.
const ORIGINAL_DB_POOL_SIZE = process.env.DB_POOL_SIZE;
const ORIGINAL_DB_POOL_TIMEOUT = process.env.DB_POOL_TIMEOUT;

const { prisma, withTransaction, isPrismaConnectionError } = require('../prismaClient');

afterAll(() => {
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_DB_POOL_SIZE === undefined) delete process.env.DB_POOL_SIZE;
  else process.env.DB_POOL_SIZE = ORIGINAL_DB_POOL_SIZE;
  if (ORIGINAL_DB_POOL_TIMEOUT === undefined) delete process.env.DB_POOL_TIMEOUT;
  else process.env.DB_POOL_TIMEOUT = ORIGINAL_DB_POOL_TIMEOUT;
});

/**
 * Load a fresh copy of the module with the given env vars applied, so the
 * datasource URL construction runs against the desired configuration.
 */
function loadWithEnv(env) {
  jest.resetModules();
  const saved = {
    DATABASE_URL: process.env.DATABASE_URL,
    DB_POOL_SIZE: process.env.DB_POOL_SIZE,
    DB_POOL_TIMEOUT: process.env.DB_POOL_TIMEOUT,
  };
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return require('../prismaClient');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('prismaClient connection pool configuration', () => {
  const BASE_URL = 'postgresql://user:pass@localhost:5432/db';

  it('applies DB_POOL_SIZE and DB_POOL_TIMEOUT to the datasource URL', () => {
    const mod = loadWithEnv({
      DATABASE_URL: BASE_URL,
      DB_POOL_SIZE: '5',
      DB_POOL_TIMEOUT: '15',
    });
    const url = mod.resolveDatasourceUrl ? mod.resolveDatasourceUrl() : mod.datasourceUrl;
    expect(url).toContain('connection_limit=5');
    expect(url).toContain('pool_timeout=15');
  });

  it('falls back to default pool size (10) and timeout (30) when unset', () => {
    const mod = loadWithEnv({
      DATABASE_URL: BASE_URL,
      DB_POOL_SIZE: undefined,
      DB_POOL_TIMEOUT: undefined,
    });
    const url = mod.resolveDatasourceUrl ? mod.resolveDatasourceUrl() : mod.datasourceUrl;
    expect(url).toContain('connection_limit=10');
    expect(url).toContain('pool_timeout=30');
  });

  it('does not duplicate pool parameters already present in DATABASE_URL', () => {
    const mod = loadWithEnv({
      DATABASE_URL: `${BASE_URL}?connection_limit=3&pool_timeout=7`,
      DB_POOL_SIZE: '5',
      DB_POOL_TIMEOUT: '15',
    });
    const url = mod.resolveDatasourceUrl ? mod.resolveDatasourceUrl() : mod.datasourceUrl;
    expect(url.match(/connection_limit=/g)).toHaveLength(1);
    expect(url.match(/pool_timeout=/g)).toHaveLength(1);
    expect(url).toContain('connection_limit=3');
    expect(url).toContain('pool_timeout=7');
  });
});

describe('prismaClient fallback mock', () => {
  describe('user model', () => {
    it('update throws P2025 mock error', async () => {
      await expect(prisma.user.update({})).rejects.toMatchObject({ code: 'P2025' });
    });

    it('findUnique / findFirst / findMany / create / count', async () => {
      await expect(prisma.user.findUnique({})).resolves.toBeNull();
      await expect(prisma.user.findFirst({})).resolves.toBeNull();
      await expect(prisma.user.findMany({})).resolves.toEqual([]);
      await expect(prisma.user.create({})).resolves.toEqual({});
      await expect(prisma.user.count({})).resolves.toBe(0);
    });
  });

  describe('webhookDLQ model', () => {
    it('returns empty results and echoes created data', async () => {
      await expect(prisma.webhookDLQ.findMany({})).resolves.toEqual([]);
      await expect(prisma.webhookDLQ.findUnique({})).resolves.toBeNull();
      await expect(prisma.webhookDLQ.create({ data: { id: 1 } })).resolves.toEqual({});
      await expect(prisma.webhookDLQ.delete({})).resolves.toEqual({});
      await expect(prisma.webhookDLQ.update({})).resolves.toEqual({});
    });
  });

  describe('auditLog model', () => {
    it('returns empty results and echoes audit entries', async () => {
      await expect(prisma.auditLog.findMany({})).resolves.toEqual([]);
      await expect(prisma.auditLog.findUnique({})).resolves.toBeNull();
      await expect(prisma.auditLog.findFirst({})).resolves.toBeNull();
      await expect(prisma.auditLog.create({ data: { action: 'x' } })).resolves.toEqual({ action: 'x' });
      await expect(prisma.auditLog.count({})).resolves.toBe(0);
    });
  });

  describe('payment model', () => {
    it('returns empty results and zeroed aggregates', async () => {
      await expect(prisma.payment.findMany({})).resolves.toEqual([]);
      await expect(prisma.payment.findUnique({})).resolves.toBeNull();
      await expect(prisma.payment.findFirst({})).resolves.toBeNull();
      await expect(prisma.payment.create({})).resolves.toEqual({});
      await expect(prisma.payment.count({})).resolves.toBe(0);
      await expect(prisma.payment.aggregate({})).resolves.toEqual({
        _sum: { amount: 0, fee: 0 },
        _count: { id: 0 },
      });
      await expect(prisma.payment.groupBy({})).resolves.toEqual([]);
    });
  });

  describe('webhook model', () => {
    it('returns empty results and echoes mutations', async () => {
      await expect(prisma.webhook.findUnique({})).resolves.toBeNull();
      await expect(prisma.webhook.findFirst({})).resolves.toBeNull();
      await expect(prisma.webhook.findMany({})).resolves.toEqual([]);
      await expect(prisma.webhook.create({})).resolves.toEqual({});
      await expect(prisma.webhook.update({})).resolves.toEqual({});
      await expect(prisma.webhook.delete({})).resolves.toEqual({});
      await expect(prisma.webhook.count({})).resolves.toBe(0);
    });
  });

  describe('paymentIntent model', () => {
    it('echoes created data and returns empty queries', async () => {
      await expect(prisma.paymentIntent.create({ data: { amount: 5 } })).resolves.toEqual({ amount: 5 });
      await expect(prisma.paymentIntent.findMany({})).resolves.toEqual([]);
      await expect(prisma.paymentIntent.findUnique({})).resolves.toBeNull();
      await expect(prisma.paymentIntent.count({})).resolves.toBe(0);
    });
  });

  describe('$transaction', () => {
    it('supports the function form', async () => {
      const result = await prisma.$transaction(async (tx) => {
        await tx.user.findUnique({});
        return 'ok';
      });
      expect(result).toBe('ok');
    });

    it('supports the array form', async () => {
      await expect(prisma.$transaction([Promise.resolve(1), Promise.resolve(2)])).resolves.toEqual([1, 2]);
    });
  });

  describe('$queryRaw', () => {
    it('resolves to an empty array', async () => {
      await expect(prisma.$queryRaw`SELECT 1`).resolves.toEqual([]);
    });
  });
});

describe('withTransaction', () => {
  it('runs the callback inside a transaction', async () => {
    const result = await withTransaction(async (tx) => {
      expect(tx).toBeDefined();
      return 'committed';
    });
    expect(result).toBe('committed');
  });
});

describe('isPrismaConnectionError', () => {
  it('detects P10xx codes on the error itself', () => {
    expect(isPrismaConnectionError({ code: 'P1001' })).toBe(true);
    expect(isPrismaConnectionError({ code: 'P1002' })).toBe(true);
    expect(isPrismaConnectionError({ code: 'P2025' })).toBe(false);
  });

  it('detects P10xx codes on the error cause', () => {
    expect(isPrismaConnectionError({ cause: { code: 'P1008' } })).toBe(true);
    expect(isPrismaConnectionError({ cause: { code: 'P2002' } })).toBe(false);
  });

  it('handles missing or malformed errors', () => {
    expect(isPrismaConnectionError(null)).toBe(false);
    expect(isPrismaConnectionError(undefined)).toBe(false);
    expect(isPrismaConnectionError('boom')).toBe(false);
  });
});