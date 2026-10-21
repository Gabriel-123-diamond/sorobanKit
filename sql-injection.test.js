const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "; DROP TABLE users; --",
  "' OR 1=1 --",
  "1'; DELETE FROM users; --",
];

const DATE_PARAMS = ['startDate', 'endDate'];

const ACTIVITY_PATH = '/users/testuser/activity';
const ADMIN_STATS_PATH = '/admin/stats';

describe('SQL injection protection', () => {
  afterAll(async () => {
    await db.destroy();
  });

  describe('registration endpoint', () => {
    it.each(INJECTION_PAYLOADS)(
      'rejects injection payload in username: %s',
      async (payload) => {
        const res = await request(app)
          .post('/auth/register')
          .send({ username: payload, password: 'ValidPass123!' });

        expect([400, 422]).toContain(res.status);
        expect(res.status).not.toBe(500);
      },
    );
  });

  describe('federation endpoint', () => {
    it.each(INJECTION_PAYLOADS)(
      'rejects injection payload in federation query: %s',
      async (payload) => {
        const res = await request(app)
          .get('/federation')
          .query({ q: payload });

        expect([400, 422]).toContain(res.status);
        expect(res.status).not.toBe(500);
      },
    );
  });

  describe('activity endpoint date filters', () => {
    it.each(DATE_PARAMS)('%s rejects injection payloads', async (param) => {
      for (const payload of INJECTION_PAYLOADS) {
        const res = await request(app)
          .get(ACTIVITY_PATH)
          .query({ [param]: payload });

        expect(res.status).toBe(400);
        expect(res.status).not.toBe(500);
      }
    });

    it('rejects injection payloads in both date params together', async () => {
      const res = await request(app)
        .get(ACTIVITY_PATH)
        .query({
          startDate: "' OR '1'='1",
          endDate: "; DROP TABLE users; --",
        });

      expect(res.status).toBe(400);
      expect(res.status).not.toBe(500);
    });
  });

  describe('admin stats groupBy parameter', () => {
    it.each(INJECTION_PAYLOADS)(
      'rejects injection payload in groupBy: %s',
      async (payload) => {
        const res = await request(app)
          .get(ADMIN_STATS_PATH)
          .query({ groupBy: payload });

        expect(res.status).toBe(400);
        expect(res.status).not.toBe(500);
      },
    );

    it("rejects groupBy='; DROP TABLE users; --", async () => {
      const res = await request(app)
        .get(ADMIN_STATS_PATH)
        .query({ groupBy: '; DROP TABLE users; --' });

      expect(res.status).toBe(400);
      expect(res.status).not.toBe(500);
    });
  });

  describe('assetCode parameter', () => {
    it.each(INJECTION_PAYLOADS)(
      'rejects injection payload in assetCode: %s',
      async (payload) => {
        const res = await request(app)
          .get(ACTIVITY_PATH)
          .query({ assetCode: payload });

        expect([400, 422]).toContain(res.status);
        expect(res.status).not.toBe(500);
      },
    );
  });
});
