'use strict';

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const correlationId = require('../src/middleware/correlationId');
const rateLimiter = require('../src/middleware/rateLimiter');
const validate = require('../src/middleware/validate');
const errorHandler = require('../src/middleware/errorHandler');

/**
 * Build a minimal Express app that wires the full middleware chain in the
 * same order as the production app: correlation ID -> rate limit -> JSON
 * body parsing -> schema validation -> handler -> error handler.
 */
function buildApp() {
  const app = express();

  app.use(correlationId);
  app.use(rateLimiter);
  app.use(express.json());

  app.post(
    '/api/echo',
    validate({
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    }),
    (req, res) => {
      res.status(200).json({
        name: req.body.name,
        correlationId: req.correlationId,
      });
    }
  );

  app.use(errorHandler);

  return app;
}

describe('API integration (full middleware chain)', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  test('request passes through all middleware and reaches the handler', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({ name: 'alice' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('alice');
  });

  test('correlation ID is injected when absent from the request', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({ name: 'bob' });

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(res.body.correlationId).toBe(res.headers['x-correlation-id']);
  });

  test('incoming correlation ID is preserved through the chain', async () => {
    const id = uuidv4();
    const res = await request(app)
      .post('/api/echo')
      .set('x-correlation-id', id)
      .send({ name: 'carol' });

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBe(id);
    expect(res.body.correlationId).toBe(id);
  });

  test('rate limit headers are present on the response', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({ name: 'dave' });

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  test('rate limit remaining decreases across requests', async () => {
    const first = await request(app)
      .post('/api/echo')
      .send({ name: 'erin' });
    const second = await request(app)
      .post('/api/echo')
      .send({ name: 'frank' });

    const firstRemaining = Number(first.headers['ratelimit-remaining']);
    const secondRemaining = Number(second.headers['ratelimit-remaining']);

    expect(secondRemaining).toBeLessThan(firstRemaining);
  });

  test('JSON body is parsed before reaching the handler', async () => {
    const res = await request(app)
      .post('/api/echo')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ name: 'grace' }));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('grace');
  });

  test('schema validation rejects a missing required field', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('schema validation rejects a wrong field type', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({ name: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('schema validation rejects additional properties', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({ name: 'heidi', extra: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('validation errors still carry a correlation ID', async () => {
    const res = await request(app)
      .post('/api/echo')
      .send({});

    expect(res.status).toBe(400);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  test('malformed JSON body is rejected by the parser', async () => {
    const res = await request(app)
      .post('/api/echo')
      .set('content-type', 'application/json')
      .send('{ not valid json');

    expect(res.status).toBe(400);
  });
});
