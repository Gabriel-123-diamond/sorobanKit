const request = require('supertest');
const app = require('../../src/app');
const { setupTestDb, teardownTestDb, seedAdminExportData } = require('./helpers/adminExportHelper');

describe('Admin export e2e', () => {
  beforeAll(async () => {
    await setupTestDb();
    await seedAdminExportData();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('exports admin data as CSV by default', async () => {
    const res = await request(app)
      .get('/admin/export')
      .set('Authorization', `Bearer ${process.env.ADMIN_TEST_TOKEN}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('exports admin data as NDJSON when format=json', async () => {
    const res = await request(app)
      .get('/admin/export?format=json')
      .set('Authorization', `Bearer ${process.env.ADMIN_TEST_TOKEN}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/x-ndjson/);

    const lines = res.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    expect(lines.length).toBeGreaterThan(0);

    const expectedFields = ['id', 'amount', 'status', 'createdAt'];

    for (const line of lines) {
      let record;
      expect(() => {
        record = JSON.parse(line);
      }).not.toThrow();

      expect(record).toBeInstanceOf(Object);
      for (const field of expectedFields) {
        expect(record).toHaveProperty(field);
      }
    }
  });
});
