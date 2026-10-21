'use strict';

/**
 * src/middleware/security.js
 *
 * Security headers middleware configured with strict Content Security Policy
 * (CSP), a Permissions-Policy to deny sensitive browser APIs the application
 * never needs, and other hardening headers via Helmet.
 */

const helmet = require('helmet');

// SECURITY REQUIREMENT: API key hash verification must be constant-time.
// Any middleware or route that compares a hash of an incoming `X-Api-Key`
// against a stored hash MUST use `crypto.timingSafeEqual` (via the shared
// helper) rather than `===` or any other string equality check. String
// comparison leaks timing information that can be used to recover the hash
// character by character. Preserve this requirement when modifying
// security-related middleware.

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

module.exports = {
  securityMiddleware,
  cspDirectives,
  permissionsPolicy,
};
