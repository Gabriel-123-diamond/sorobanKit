'use strict';

/**
 * Registry of deprecated API paths.
 *
 * Each entry maps a deprecated route prefix to metadata describing the
 * deprecation. `sunsetDate` is the date after which the route will no longer
 * be available (RFC 8594). It may be a Date instance or an ISO 8601 string.
 */
const deprecations = {
  '/api/v1/users': {
    deprecatedAt: '2024-01-01T00:00:00.000Z',
    sunsetDate: '2025-01-01T00:00:00.000Z',
    replacement: '/api/v2/users',
  },
  '/api/v1/orders': {
    deprecatedAt: '2024-03-01T00:00:00.000Z',
    sunsetDate: '2025-03-01T00:00:00.000Z',
    replacement: '/api/v2/orders',
  },
  '/api/v1/products': {
    deprecatedAt: '2024-06-01T00:00:00.000Z',
    sunsetDate: '2025-06-01T00:00:00.000Z',
    replacement: '/api/v2/products',
  },
};

module.exports = deprecations;
