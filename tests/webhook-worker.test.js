'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const SECRET = 'super-secret-hmac-value';
const FULL_URL = 'https://hooks.example.com/services/T000/B000/abcdef';

function captureLogs(logger) {
  const captured = [];
  const original = {};
  for (const level of ['debug', 'info', 'warn', 'error', 'log']) {
    if (typeof logger[level] === 'function') {
      original[level] = logger[level];
      logger[level] = (...args) => {
        captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      };
    }
  }
  return {
    captured,
    restore() {
      for (const level of Object.keys(original)) {
        logger[level] = original[level];
      }
    },
  };
}

let logger;
let webhookWorker;
let capture;

beforeEach(() => {
  logger = require('../src/logger');
  webhookWorker = require('../src/webhookWorker');
  capture = captureLogs(logger);
});

afterEach(() => {
  capture.restore();
});

function buildWebhook() {
  return {
    id: 'wh_123',
    url: FULL_URL,
    secret: SECRET,
    events: ['payment.created'],
    active: true,
  };
}

test('webhook worker logs do not contain the secret field', async () => {
  const webhook = buildWebhook();
  const payload = { id: 'evt_1', type: 'payment.created', data: { amount: 100 } };

  if (typeof webhookWorker.logDeliveryAttempt === 'function') {
    await webhookWorker.logDeliveryAttempt(webhook, { status: 200 }, payload);
  }
  if (typeof webhookWorker.logDeliveryError === 'function') {
    await webhookWorker.logDeliveryError(webhook, new Error('boom'), payload);
  }

  const output = capture.captured.join('\n');
  assert.ok(!output.includes(SECRET), 'log output must not contain the webhook secret');
  assert.ok(!/secret/i.test(output), 'log output must not contain a secret field');
});

test('webhook worker logs only the webhook domain, not the full URL', async () => {
  const webhook = buildWebhook();
  const payload = { id: 'evt_2', type: 'payment.created', data: { amount: 200 } };

  if (typeof webhookWorker.logDeliveryAttempt === 'function') {
    await webhookWorker.logDeliveryAttempt(webhook, { status: 200 }, payload);
  }
  if (typeof webhookWorker.logDeliveryError === 'function') {
    await webhookWorker.logDeliveryError(webhook, new Error('boom'), payload);
  }

  const output = capture.captured.join('\n');
  assert.ok(!output.includes(FULL_URL), 'log output must not contain the full webhook URL');
  assert.ok(!output.includes('/services/T000/B000/abcdef'), 'log output must not contain the URL path');
  if (output.length > 0) {
    assert.ok(output.includes('hooks.example.com'), 'log output should include the webhook domain');
  }
});
