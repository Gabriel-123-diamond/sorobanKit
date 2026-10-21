'use strict';

/**
 * src/middleware/security.js
 *
 * Security headers middleware configured with strict Content Security Policy
 * (CSP), a Permissions-Policy to deny sensitive browser APIs the application
 * never needs, and other hardening headers via Helmet.
 *
 * Also provides a tiered rate limiter that grants authenticated clients
 * (valid `X-Api-Key`) a higher request budget than anonymous clients.
 */

const helmet = require('helmet');

// API-only service: block every resource type by default. Explicit allowances
// (script-src, style-src, etc.) are intentionally absent because no HTML is
// served and no browser will render a page from this origin.
const cspDirectives = {
  defaultSrc: ["'none'"],
  scriptSrc: ["'none'"],
  styleSrc: ["'none'"],
  imgSrc: ["'none'"],
  fontSrc: ["'none'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'none'"],
};

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  frameguard: {
    action: 'deny',
  },
  hidePoweredBy: true,
  referrerPolicy: {
    policy: 'no-referrer',
  },
  xContentTypeOptions: true,
});

/**
 * Sets a Permissions-Policy header that denies browser APIs the payment
 * platform never needs.  This prevents an XSS payload from silently accessing
 * the camera, microphone, or geolocation of a user who has previously granted
 * those permissions to the domain.
 *
 * The header is applied after Helmet so it cannot be overwritten by Helmet's
 * own processing.
 */
const permissionsPolicy = (_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  next();
};

/**
 * Combined security middleware: Helmet hardening + Permissions-Policy.
 * Mount this once at the top of the middleware stack.
 */
const securityMiddleware = [helmetMiddleware, permissionsPolicy];

// ---------------------------------------------------------------------------
// Tiered rate limiting
// ---------------------------------------------------------------------------

const WINDOW_MS = 60 * 1000; // one minute fixed window

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

const RATE_LIMIT_AUTHENTICATED = parsePositiveInt(
  process.env.RATE_LIMIT_AUTHENTICATED,
  1000,
);
const RATE_LIMIT_ANONYMOUS = parsePositiveInt(
  process.env.RATE_LIMIT_ANONYMOUS,
  100,
);

/**
 * Determines whether the request carries a validated API key.
 *
 * A key is considered valid when it is present in the `X-Api-Key` header and
 * the upstream authentication middleware has flagged the request as
 * authenticated (e.g. `req.apiKey`, `req.isAuthenticated`, or
 * `req.auth.authenticated`).  Invalid or missing keys fall back to the
 * anonymous tier.
 */
function hasValidApiKey(req) {
  const headerKey = req.headers && req.headers['x-api-key'];
  if (!headerKey || typeof headerKey !== 'string' || headerKey.trim() === '') {
    return false;
  }

  if (req.apiKey && req.apiKey.valid === true) {
    return true;
  }
  if (req.isAuthenticated === true) {
    return true;
  }
  if (req.auth && req.auth.authenticated === true) {
    return true;
  }
  return false;
}

/**
 * In-memory store keyed by tier + client identifier.  Redis-backed storage
 * can be swapped in by replacing this object with a compatible implementation
 * exposing `get`, `set`, and `delete`.
 */
function createMemoryStore() {
  const buckets = new Map();
  return {
    get(key) {
      return buckets.get(key);
    },
    set(key, value) {
      buckets.set(key, value);
    },
    delete(key) {
      buckets.delete(key);
    },
  };
}

function getClientId(req) {
  return (
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown'
  );
}

/**
 * Builds a tiered rate limiter middleware.
 *
 * @param {object} [options]
 * @param {object} [options.store]  Storage backend (defaults to in-memory).
 * @param {number} [options.windowMs] Window length in milliseconds.
 * @param {number} [options.authenticatedLimit] Requests/min for valid keys.
 * @param {number} [options.anonymousLimit] Requests/min for anonymous clients.
 */
function createRateLimiter(options = {}) {
  const store = options.store || createMemoryStore();
  const windowMs = options.windowMs || WINDOW_MS;
  const authenticatedLimit =
    options.authenticatedLimit || RATE_LIMIT_AUTHENTICATED;
  const anonymousLimit = options.anonymousLimit || RATE_LIMIT_ANONYMOUS;

  return function rateLimiter(req, res, next) {
    const authenticated = hasValidApiKey(req);
    const tier = authenticated ? 'auth' : 'anon';
    const limit = authenticated ? authenticatedLimit : anonymousLimit;
    const clientId = getClientId(req);
    const bucketKey = `${tier}:${clientId}`;

    const now = Date.now();
    let bucket = store.get(bucketKey);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    bucket.count += 1;
    store.set(bucketKey, bucket);

    const remaining = Math.max(0, limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));
    res.setHeader('X-RateLimit-Tier', authenticated ? 'authenticated' : 'anonymous');

    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please retry later.',
        tier: authenticated ? 'authenticated' : 'anonymous',
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}

const rateLimiter = createRateLimiter();

module.exports = {
  securityMiddleware,
  cspDirectives,
  permissionsPolicy,
  createRateLimiter,
  rateLimiter,
  hasValidApiKey,
  RATE_LIMIT_AUTHENTICATED,
  RATE_LIMIT_ANONYMOUS,
};