const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const { deliverWebhook } = require('../src/webhooks/delivery');
const { replayDlqEntry } = require('../src/webhooks/dlq');

jest.mock('../src/webhooks/delivery');

describe('webhook DLQ', () => {
  beforeEach(async () => {
    await db('webhook_dlq').del();
    await db('webhook_deliveries').del();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('creates a DLQ entry when delivery fails', async () => {
    deliverWebhook.mockRejectedValueOnce(new Error('endpoint unreachable'));

    await request(app)
      .post('/webhooks/test-endpoint')
      .send({ event: 'test.event', payload: { id: 1 } })
      .expect(202);

    const entries = await db('webhook_dlq').select('*');
    expect(entries).toHaveLength(1);
    expect(entries[0].endpoint_url).toBe('https://example.test/hook');
    expect(entries[0].replayed_at).toBeNull();
  });

  it('replays a DLQ entry and marks it replayed on success', async () => {
    deliverWebhook.mockRejectedValueOnce(new Error('endpoint unreachable'));

    await request(app)
      .post('/webhooks/test-endpoint')
      .send({ event: 'test.event', payload: { id: 2 } })
      .expect(202);

    const [entry] = await db('webhook_dlq').select('*');
    expect(entry).toBeDefined();
    expect(entry.replayed_at).toBeNull();

    // Mock the delivery endpoint to succeed on replay.
    deliverWebhook.mockResolvedValueOnce({ status: 200 });

    await replayDlqEntry(entry.id);

    // Replay triggers a new delivery attempt with the original endpoint URL.
    expect(deliverWebhook).toHaveBeenCalledTimes(2);
    expect(deliverWebhook).toHaveBeenLastCalledWith(
      entry.endpoint_url,
      expect.objectContaining({ event: 'test.event' })
    );

    // Successful replay marks the DLQ entry as replayed.
    const replayed = await db('webhook_dlq').where({ id: entry.id }).first();
    expect(replayed.replayed_at).not.toBeNull();
  });

  it('replays a DLQ entry via the replay endpoint', async () => {
    deliverWebhook.mockRejectedValueOnce(new Error('endpoint unreachable'));

    await request(app)
      .post('/webhooks/test-endpoint')
      .send({ event: 'test.event', payload: { id: 3 } })
      .expect(202);

    const [entry] = await db('webhook_dlq').select('*');
    expect(entry).toBeDefined();

    deliverWebhook.mockResolvedValueOnce({ status: 200 });

    await request(app)
      .post(`/webhooks/dlq/${entry.id}/replay`)
      .expect(200);

    expect(deliverWebhook).toHaveBeenCalledTimes(2);

    const replayed = await db('webhook_dlq').where({ id: entry.id }).first();
    expect(replayed.replayed_at).not.toBeNull();
  });
});
