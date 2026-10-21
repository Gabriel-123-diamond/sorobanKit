const { logger } = require('../logger');
const deprecations = require('../config/deprecations');

/**
 * Format a sunset date as an HTTP date (RFC 7231 / RFC 8594).
 *
 * @param {string|number|Date} value - Date value to format.
 * @returns {string|undefined} HTTP date string, or undefined if invalid.
 */
function toHttpDate(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toUTCString();
}

/**
 * Resolve the sunset date for a request from the deprecations config.
 *
 * @param {import('express').Request} req
 * @returns {string|undefined} HTTP date string for the Sunset header.
 */
function resolveSunset(req) {
  const route = req.originalUrl || req.url || req.path;

  if (!route || !deprecations) {
    return undefined;
  }

  const path = route.split('?')[0];

  for (const [prefix, config] of Object.entries(deprecations)) {
    if (path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)) {
      return toHttpDate(config && config.sunsetDate);
    }
  }

  return undefined;
}

/**
 * Middleware that marks deprecated endpoints by setting the standard
 * `Deprecation` and `Sunset` response headers, and logs a warning whenever a
 * deprecated endpoint is actually called so adoption can be measured.
 *
 * @param {Object} options
 * @param {string} [options.sunset] - HTTP date when the endpoint will be removed.
 * @param {string} [options.link] - Link header value pointing to deprecation docs.
 * @returns {import('express').RequestHandler}
 */
function deprecation({ sunset, link } = {}) {
  return function deprecationMiddleware(req, res, next) {
    res.setHeader('Deprecation', 'true');

    const sunsetHeader = sunset ? toHttpDate(sunset) : resolveSunset(req);

    if (sunsetHeader) {
      res.setHeader('Sunset', sunsetHeader);
    }

    if (link) {
      res.setHeader('Link', link);
    }

    logger.warn('Deprecated endpoint called', {
      route: req.originalUrl || req.url,
      correlationId: req.correlationId || req.id,
    });

    next();
  };
}

module.exports = deprecation;
module.exports.deprecation = deprecation;
module.exports.toHttpDate = toHttpDate;
