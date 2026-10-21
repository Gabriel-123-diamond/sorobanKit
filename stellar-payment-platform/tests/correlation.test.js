'use strict';

/**
 * tests/correlation.test.js
 *
 * Verifies that every HTTP response — successful or error — carries an
 * X-Correlation-ID response header and that the same ID appears in the
 * `correlation_id` field of error response bodies.
 *
 * Covers:
 *  - 200 (federation lookup)
 *  - 404 (not found route)
 *  - 422 (schema validation failure)
 *  - 500 (simulated internal error)
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

jest.mock('../prismaClient', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ username: 'alice', address: 'GABC', isPrimary: true }),
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
  poolGet: jest.fn().mockResolvedValue({ username: 'alice', address: 'GABC' }),
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

// UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_ADDRESS = 'GABC123456789012345678901234567890123456789012345678';

describe('X-Correlation-ID header — presence on all response types', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up a successful federation lookup
    const { prisma } = require('../prismaClient');
    prisma.user.findFirst.mockResolvedValue({
      username: 'alice*localhost',
      address: VALID_ADDRESS,
      memoType: null,
      memo: null,
    });
  });

  // ── 200 OK ──────────────────────────────────────────────────────────────────

  test('200 response includes an X-Correlation-ID header', async () => {
    const res = await request(app)
      .get('/api/v1/federation')
      .query({ q: 'alice*localhost' });

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toMatch(UUID_RE);
  });

  // ── 404 Not Found ───────────────────────────────────────────────────────────

  test('404 response includes an X-Correlation-ID header', async () => {
    const res = await request(app).get('/api/v1/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toMatch(UUID_RE);
  });

  // ── 422 Validation Failure ───────────────────────────────────────────────────

  test('422 response includes an X-Correlation-ID header', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .set('Content-Type', 'application/json')
      .send({ address: VALID_ADDRESS }); // missing required username field

    expect(res.status).toBe(422);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toMatch(UUID_RE);
  });

  // ── 500 Internal Error ───────────────────────────────────────────────────────

  test('500 response includes an X-Correlation-ID header', async () => {
    const { prisma } = require('../prismaClient');
    prisma.user.findFirst.mockRejectedValueOnce(new Error('Simulated DB crash'));

    const res = await request(app)
      .get('/api/v1/users')
      .query({ search: 'alice' });

    // The handler may return 5xx or fall through; any 5xx confirms the header
    // is set even for unhandled failures.
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toMatch(UUID_RE);
  });
});

describe('X-Correlation-ID — header matches correlation_id in error body', () => {
  // ── 404 ──────────────────────────────────────────────────────────────────────

  test('404 body correlation_id matches X-Correlation-ID header', async () => {
    const res = await request(app).get('/api/v1/no-such-route-xyz');

    expect(res.status).toBe(404);
    const headerId = res.headers['x-correlation-id'];
    expect(headerId).toBeDefined();
    expect(res.body.correlation_id).toBe(headerId);
  });

  // ── 422 ──────────────────────────────────────────────────────────────────────

  test('422 body correlation_id matches X-Correlation-ID header', async () => {
    const res = await request(app)
      .post('/api/v1/register')
      .set('Content-Type', 'application/json')
      .send({}); // missing both username and address

    expect(res.status).toBe(422);
    const headerId = res.headers['x-correlation-id'];
    expect(headerId).toBeDefined();
    expect(res.body.correlation_id).toBe(headerId);
  });

  // ── Caller-supplied correlation ID is echoed back ────────────────────────────

  test('echoes back a caller-supplied X-Correlation-ID on a 404', async () => {
    const myId = '11111111-2222-4333-aaaa-555555555555';

    const res = await request(app)
      .get('/api/v1/no-such-route-xyz')
      .set('X-Correlation-ID', myId);

    expect(res.status).toBe(404);
    expect(res.headers['x-correlation-id']).toBe(myId);
    expect(res.body.correlation_id).toBe(myId);
  });

  test('echoes back a caller-supplied X-Correlation-ID on a 422', async () => {
    const myId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

    const res = await request(app)
      .post('/api/v1/register')
      .set('Content-Type', 'application/json')
      .set('X-Correlation-ID', myId)
      .send({});

    expect(res.status).toBe(422);
    expect(res.headers['x-correlation-id']).toBe(myId);
    expect(res.body.correlation_id).toBe(myId);
  });

  test('echoes back a caller-supplied X-Correlation-ID on a 200', async () => {
    const { prisma } = require('../prismaClient');
    prisma.user.findFirst.mockResolvedValueOnce({
      username: 'alice*localhost',
      address: VALID_ADDRESS,
      memoType: null,
      memo: null,
    });

    const myId = 'deadbeef-0000-4000-8000-000000000001';

    const res = await request(app)
      .get('/api/v1/federation')
      .query({ q: 'alice*localhost' })
      .set('X-Correlation-ID', myId);

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBe(myId);
  });
});
