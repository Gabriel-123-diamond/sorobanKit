const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const redis = require('../src/redis');
const horizon = require('../src/horizon');

describe('GET /health', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 200 with status UP when all dependencies are healthy', async () => {
    jest.spyOn(db, 'ping').mockResolvedValue(true);
    jest.spyOn(redis, 'ping').mockResolvedValue(true);
    jest.spyOn(horizon, 'ping').mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('returns 503 with status DOWN when the database is down', async () => {
    jest.spyOn(db, 'ping').mockRejectedValue(new Error('db down'));
    jest.spyOn(redis, 'ping').mockResolvedValue(true);
    jest.spyOn(horizon, 'ping').mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
    expect(res.body.message).toMatch(/database/i);
  });

  it('returns 503 with status DOWN when Redis is down', async () => {
    jest.spyOn(db, 'ping').mockResolvedValue(true);
    jest.spyOn(redis, 'ping').mockRejectedValue(new Error('redis down'));
    jest.spyOn(horizon, 'ping').mockResolvedValue(true);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
    expect(res.body.message).toMatch(/redis/i);
  });

  it('returns 503 with status DOWN when Horizon is down', async () => {
    jest.spyOn(db, 'ping').mockResolvedValue(true);
    jest.spyOn(redis, 'ping').mockResolvedValue(true);
    jest.spyOn(horizon, 'ping').mockRejectedValue(new Error('horizon down'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
    expect(res.body.message).toMatch(/horizon/i);
  });

  it('returns 503 with status DOWN when all dependencies are down simultaneously', async () => {
    jest.spyOn(db, 'ping').mockRejectedValue(new Error('db down'));
    jest.spyOn(redis, 'ping').mockRejectedValue(new Error('redis down'));
    jest.spyOn(horizon, 'ping').mockRejectedValue(new Error('horizon down'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
    expect(res.body.message).toMatch(/database/i);
    expect(res.body.message).toMatch(/redis/i);
    expect(res.body.message).toMatch(/horizon/i);
  });
});
