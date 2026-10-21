'use strict';

/**
 * tests/v2-routes.test.js
 *
 * Dedicated tests for the /api/v2 route module.
 *
 * v2 behaviour:
 *   - GET /api/v2/          → returns { apiVersion: 'v2', status: 'ok' }
 *   - All other endpoints fall through to the v1 router but are served with
 *     req.apiVersion === 'v2' so v2-specific middleware can differentiate.
 *
 * For every endpoint tested under v1 the same request is repeated under v2 and
 * the results are compared so regressions introduced only in the v2 path are
 * caught before the v1 tests even run.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: { Server: jest.fn() },
  StrKey: {
    isValidEd25519PublicKey: jest.fn((v) => typeof v === 'string' && v.startsWith('G')),
  },
  Keypair: {
    fromPublicKey: jest.fn(() => ({ verify: jest.fn(() => true) })),
  },
}));

jest.mock('redis', () => ({ createClient: jest.fn(() => null) }));
jest.mock('../src/cleanup-cron', () => ({ scheduleCleanupJob: jest.fn() }));
jest.mock('../src/soft-delete-purge-cron', () => ({
  scheduleSoftDeletePurgeJob: jest.fn(),
}));

// Mock verifyMultiSignerThreshold so registration tests don't need Horizon.
jest.mock('../src/multisigner-verifier', () => ({
  verifyMultiSignerThreshold: jest.fn().mockResolvedValue({
    success: true,
    accountId: 'GABC',
    signerCount: 1,
    thresholdMet: true,
    requiredThreshold: 0,
    totalWeight: 1,
    errorMessage: null,
  }),
}));

const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('../prismaClient', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      count: mockCount,
      create: mockCreate,
      update: jest.fn(),
    },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    activityLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([0, []]),
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    $metrics: {
      json: jest.fn().mockResolvedValue({ counters: [], gauges: [], histograms: [] }),
    },
  },
  isPrismaConnectionError: () => false,
}));

jest.mock('../src/db', () => ({
  poolGet: jest.fn().mockResolvedValue(null),
  poolRun: jest.fn().mockResolvedValue({ changes: 1 }),
  poolAll: jest.fn().mockResolvedValue([]),
  etagCache: (_req, _res, next) => next(),
  normalizeNameTag: require('../src/utils').normalizeNameTag,
  USER_DATABASE: {},
}));

jest.mock('../src/services/activityService', () => ({
  ACTIVITY_ACTIONS: { USER_REGISTERED: 'user.registered' },
  recordActivity: jest.fn().mockResolvedValue(undefined),
  listActivity: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  parseDateRange: jest.fn().mockReturnValue({ range: null, error: null }),
  serializeActivity: jest.fn((r) => r),
}));

jest.mock('pdfkit', () => jest.fn());

process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'test-admin-key';

const request = require('supertest');
const { app } = require('../server');

const VALID_ADDRESS = 'GABC123456789012345678901234567890123456789012345678';

// ── v2 Root ───────────────────────────────────────────────────────────────────

describe('GET /api/v2/ — v2 root banner', () => {
  test('returns 200 with apiVersion: v2 and status: ok', async () => {
    const res = await request(app).get('/api/v2/');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ apiVersion: 'v2', status: 'ok' });
  });

  test('does NOT return apiVersion: v1 on the v2 root', async () => {
    const res = await request(app).get('/api/v2/');

    expect(res.body.apiVersion).not.toBe('v1');
  });

  test('v2 root is distinct from v1 (v1 has no root banner)', async () => {
    const v2 = await request(app).get('/api/v2/');
    const v1 = await request(app).get('/api/v1/');

    // v2 root returns the banner; v1 root falls through to a 404
    expect(v2.status).toBe(200);
    expect(v2.body).toMatchObject({ apiVersion: 'v2' });
    // v1 root should NOT return the v2 banner
    expect(v1.body.apiVersion).not.toBe('v2');
  });

  test('X-Correlation-ID is present on the v2 root 200 response', async () => {
    const res = await request(app).get('/api/v2/');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});

// ── v2 Federation ─────────────────────────────────────────────────────────────

describe('GET /api/v2/federation — falls through to v1 handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue({
      username: 'alice*localhost',
      address: VALID_ADDRESS,
      memoType: null,
      memo: null,
    });
  });

  test('returns 200 with the same body as /api/v1/federation', async () => {
    const v2 = await request(app)
      .get('/api/v2/federation')
      .query({ q: 'alice*localhost' });
    const v1 = await request(app)
      .get('/api/v1/federation')
      .query({ q: 'alice*localhost' });

    expect(v2.status).toBe(200);
    expect(v2.status).toBe(v1.status);
    expect(v2.body).toEqual(v1.body);
  });

  test('returns 400 when the q parameter is missing (same as v1)', async () => {
    const v2 = await request(app).get('/api/v2/federation');
    const v1 = await request(app).get('/api/v1/federation');

    expect(v2.status).toBe(400);
    expect(v2.status).toBe(v1.status);
  });

  test('returns 404 when the username is not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v2/federation')
      .query({ q: 'unknown*localhost' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('includes X-Correlation-ID header on 200', async () => {
    const res = await request(app)
      .get('/api/v2/federation')
      .query({ q: 'alice*localhost' });

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  test('includes X-Correlation-ID header on 404', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v2/federation')
      .query({ q: 'nobody*localhost' });

    expect(res.status).toBe(404);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  test('body correlation_id matches header on 404', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v2/federation')
      .query({ q: 'nobody*localhost' });

    expect(res.status).toBe(404);
    const headerId = res.headers['x-correlation-id'];
    expect(headerId).toBeDefined();
    expect(res.body.correlation_id).toBe(headerId);
  });
});

// ── v2 Register ───────────────────────────────────────────────────────────────

describe('POST /api/v2/register — falls through to v1 registration handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      username: 'alice*localhost',
      address: VALID_ADDRESS,
      isPrimary: true,
    });
  });

  test('registers successfully and returns the same body shape as v1', async () => {
    const v2 = await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'alice', address: VALID_ADDRESS });

    const v1 = await request(app)
      .post('/api/v1/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'alice', address: VALID_ADDRESS });

    expect([200, 201]).toContain(v2.status);
    expect(v2.status).toBe(v1.status);
    expect(v2.body.ok).toBe(true);
    expect(v2.body.is_primary).toBe(v1.body.is_primary);
  });

  test('normalises mixed-case username to lowercase on the v2 path', async () => {
    await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'Alice', address: VALID_ADDRESS });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: expect.stringMatching(/^alice\*/) }),
      }),
    );
  });

  test('returns 422 when username is missing (same as v1)', async () => {
    const v2 = await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ address: VALID_ADDRESS });

    expect(v2.status).toBe(422);
    expect(v2.body.success).toBe(false);
  });

  test('returns 409 when the address has the maximum usernames', async () => {
    mockCount.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'alice', address: VALID_ADDRESS });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  test('includes X-Correlation-ID header on success', async () => {
    const res = await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ username: 'alice', address: VALID_ADDRESS });

    expect([200, 201]).toContain(res.status);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  test('includes X-Correlation-ID and body correlation_id on 422', async () => {
    const res = await request(app)
      .post('/api/v2/register')
      .set('Content-Type', 'application/json')
      .send({ address: VALID_ADDRESS });

    expect(res.status).toBe(422);
    const headerId = res.headers['x-correlation-id'];
    expect(headerId).toBeDefined();
    expect(res.body.correlation_id).toBe(headerId);
  });
});

// ── v2 Stats ──────────────────────────────────────────────────────────────────

describe('GET /api/v2/stats — falls through to v1 stats handler', () => {
  test('returns same status as /api/v1/stats', async () => {
    const v2 = await request(app).get('/api/v2/stats');
    const v1 = await request(app).get('/api/v1/stats');

    expect(v2.status).toBe(v1.status);
  });

  test('includes X-Correlation-ID header', async () => {
    const res = await request(app).get('/api/v2/stats');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});

// ── Unknown v2 sub-paths ──────────────────────────────────────────────────────

describe('Unknown routes under /api/v2/', () => {
  test('returns 404 for a completely unknown v2 path', async () => {
    const res = await request(app).get('/api/v2/does-not-exist-at-all');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('includes X-Correlation-ID on 404', async () => {
    const res = await request(app).get('/api/v2/no-such-route');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  test('body correlation_id matches header on 404', async () => {
    const res = await request(app).get('/api/v2/no-such-route');
    const headerId = res.headers['x-correlation-id'];
    expect(headerId).toBeDefined();
    expect(res.body.correlation_id).toBe(headerId);
  });
});
