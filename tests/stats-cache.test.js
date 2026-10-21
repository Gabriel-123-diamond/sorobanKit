const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

// NOTE: The stats cache uses TTL-based expiry only — there is no explicit
// invalidation when underlying data changes. New payment intents therefore
// become visible in /api/stats only after the cache TTL window elapses.
// These tests document that expected staleness window.
const STATS_CACHE_TTL_MS = Number(process.env.STATS_CACHE_TTL_MS) || 5000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('stats cache', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM payment_intents');
    await db.query('DELETE FROM stats_cache');
  });

  afterAll(async () => {
    await db.end();
  });

  it('serves stats from cache after the first fetch', async () => {
    await db.query(
      "INSERT INTO payment_intents (amount, status) VALUES (100, 'completed')"
    );

    const first = await request(app).get('/api/stats');
    expect(first.status).toBe(200);
    expect(first.body.totalVolume).toBe(100);

    // Insert directly without going through the API so the cache is not
    // touched; the second fetch should still return the cached value.
    await db.query(
      "INSERT INTO payment_intents (amount, status) VALUES (50, 'completed')"
    );

    const second = await request(app).get('/api/stats');
    expect(second.status).toBe(200);
    expect(second.body.totalVolume).toBe(100);
  });

  it('reflects new payment intents after the cache TTL expires', async () => {
    // Warm the cache.
    const warm = await request(app).get('/api/stats');
    expect(warm.status).toBe(200);
    expect(warm.body.totalVolume).toBe(0);

    // Create a new payment intent through the API.
    const created = await request(app)
      .post('/api/payment-intents')
      .send({ amount: 250, status: 'completed' });
    expect(created.status).toBe(201);

    // Within the TTL window the cache still serves the stale value.
    const stale = await request(app).get('/api/stats');
    expect(stale.status).toBe(200);
    expect(stale.body.totalVolume).toBe(0);

    // After the TTL window the cache expires and the new intent is reflected.
    await wait(STATS_CACHE_TTL_MS + 250);

    const refreshed = await request(app).get('/api/stats');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.totalVolume).toBe(250);
  });
});
