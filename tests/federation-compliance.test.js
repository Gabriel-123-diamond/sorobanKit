const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');

// Helper to register a federation address for a user
async function registerAddress(username, accountId) {
  return db.query(
    'INSERT INTO federation_addresses (username, account_id) VALUES ($1, $2) RETURNING *',
    [username, accountId]
  );
}

describe('Federation compliance', () => {
  const accountId = 'GD5DJQDKEQPQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ';

  beforeEach(async () => {
    await db.query('DELETE FROM federation_addresses');
  });

  afterAll(async () => {
    await db.query('DELETE FROM federation_addresses');
  });

  describe('GET /federation (name)', () => {
    it('returns the account_id for a registered username', async () => {
      await registerAddress('alice', accountId);

      const res = await request(app)
        .get('/federation')
        .query({ q: 'alice*example.com', type: 'name' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        stellar_address: 'alice*example.com',
        account_id: accountId,
      });
    });

    it('returns 404 for an unknown username', async () => {
      const res = await request(app)
        .get('/federation')
        .query({ q: 'nobody*example.com', type: 'name' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /federation?type=forward', () => {
    it('returns the account_id for a registered username', async () => {
      await registerAddress('bob', accountId);

      const res = await request(app)
        .get('/federation')
        .query({ q: 'bob*example.com', type: 'forward' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        stellar_address: 'bob*example.com',
        account_id: accountId,
      });
    });
  });

  describe('GET /federation?type=id (reverse federation)', () => {
    it('returns the stellar_address for a registered account_id', async () => {
      await registerAddress('carol', accountId);

      const res = await request(app)
        .get('/federation')
        .query({ q: accountId, type: 'id' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        stellar_address: 'carol*example.com',
        account_id: accountId,
      });
    });

    it('returns 404 for an address with no username', async () => {
      const res = await request(app)
        .get('/federation')
        .query({ q: accountId, type: 'id' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for a soft-deleted address', async () => {
      await registerAddress('dave', accountId);
      await db.query(
        'UPDATE federation_addresses SET deleted_at = NOW() WHERE username = $1',
        ['dave']
      );

      const res = await request(app)
        .get('/federation')
        .query({ q: accountId, type: 'id' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /lookup (reverse federation)', () => {
    it('returns the stellar_address for a registered account_id', async () => {
      await registerAddress('erin', accountId);

      const res = await request(app)
        .get('/lookup')
        .query({ q: accountId });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        stellar_address: 'erin*example.com',
        account_id: accountId,
      });
    });

    it('returns 404 for an address with no username', async () => {
      const res = await request(app)
        .get('/lookup')
        .query({ q: accountId });

      expect(res.status).toBe(404);
    });

    it('returns 404 for a soft-deleted address', async () => {
      await registerAddress('frank', accountId);
      await db.query(
        'UPDATE federation_addresses SET deleted_at = NOW() WHERE username = $1',
        ['frank']
      );

      const res = await request(app)
        .get('/lookup')
        .query({ q: accountId });

      expect(res.status).toBe(404);
    });
  });
});
