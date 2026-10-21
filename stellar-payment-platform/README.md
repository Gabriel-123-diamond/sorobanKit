# Stellar Payment Platform

A payment platform built on the Stellar network, providing webhook delivery, API access, and rate limiting for merchants and integrators.

## Table of Contents

- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Webhook Delivery & Retries](#webhook-delivery--retries)
- [Rate Limiting](#rate-limiting)
- [Testing](#testing)

## Getting Started

1. Copy `.env.example` to `.env` and fill in the required values.
2. Install dependencies: `npm install`
3. Run the application: `npm start`

## Environment Variables

See `.env.example` for the full list of supported variables and their defaults.

### Webhook Retry Configuration

Failed webhook deliveries are retried using **exponential backoff with jitter**. The retry strategy is configurable via the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `WEBHOOK_RETRY_BASE_MS` | `30000` | Base delay in milliseconds for the first retry (30 seconds). |
| `WEBHOOK_RETRY_MAX_MS` | `3600000` | Maximum delay cap in milliseconds (1 hour). Delays never exceed this value regardless of attempt count. |
| `WEBHOOK_RETRY_FACTOR` | `2` | Multiplier applied to the delay for each successive attempt. |

The delay for a given attempt is computed as:

```
delay = min(base * factor^(attempt - 1), max)
```

A ±10% jitter is applied to each computed delay so that concurrent retries are not perfectly synchronised, reducing the risk of a thundering herd against a recovering endpoint.

**Example** (with defaults): attempt 1 → ~30s, attempt 2 → ~60s, attempt 3 → ~120s, attempt 4 → ~240s, … capped at 3600s.

### Rate Limiting Configuration

The rate limiter applies tiered limits based on whether a request carries a valid API key:

| Variable | Default | Description |
| --- | --- | --- |
| `RATE_LIMIT_AUTHENTICATED` | `1000` | Requests per minute allowed for authenticated clients (valid `X-Api-Key`). |
| `RATE_LIMIT_ANONYMOUS` | `100` | Requests per minute allowed for anonymous clients. |

## Webhook Delivery & Retries

Webhooks are delivered by a background worker. On delivery failure, the worker schedules a retry using the exponential backoff strategy described above. The retry delay increases between attempts and is capped at `WEBHOOK_RETRY_MAX_MS`. After the maximum number of attempts is exhausted, the delivery is moved to the dead-letter queue (DLQ).

Webhook states:

- **healthy** — deliveries are succeeding.
- **never delivered** — no delivery attempt has succeeded yet.
- **failing** — recent delivery attempts have failed and retries are in progress with exponential backoff.

## Rate Limiting

The rate limiter differentiates between authenticated and anonymous clients:

- **Authenticated clients** — requests carrying a valid `X-Api-Key` header are subject to the higher `RATE_LIMIT_AUTHENTICATED` limit (default 1000 req/min). These are treated as legitimate integrators.
- **Anonymous clients** — requests without an API key, or with an invalid API key, fall back to the lower `RATE_LIMIT_ANONYMOUS` limit (default 100 req/min).

Because the two tiers are tracked separately, anonymous traffic cannot exhaust the authenticated pool, and authenticated integrators are not throttled at the anonymous ceiling.

When a client exceeds its limit, the server responds with HTTP `429 Too Many Requests` and includes a `Retry-After` header indicating how many seconds the client should wait before retrying.

## Testing

Run the test suite with:

```
npm test
```

Relevant test files:

- `tests/webhook-worker.test.js` — asserts that retry delays increase between attempts and are capped at the configured maximum.
- `tests/rate-limit.test.js` — covers the authenticated and anonymous tiers, the invalid-key fallback, and the `Retry-After` header on `429` responses.