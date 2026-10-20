'use strict';

const { z } = require('zod');
const xss = require('xss');

/**
 * Zod transform that strips HTML/JS tags from a string using the `xss`
 * library. Apply this after `.trim()` on every free-text field that could be
 * stored and later rendered in a browser context. Fields whose content is
 * structurally constrained (Stellar addresses, numeric codes, enums) do not
 * need this because their shape already prohibits injection payloads.
 *
 * Usage:
 *   z.string().trim().transform(sanitizeString)
 *   // or via the helper:
 *   sanitized(z.string().trim().optional())
 */
const sanitizeString = (value) => {
  if (value === undefined || value === null) return value;
  return xss(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] });
};

/**
 * Wraps a Zod string schema with XSS sanitization as its final transform.
 * The schema must already be a ZodString (or ZodOptional<ZodString>) — add
 * .trim() and any other refinements before passing it in.
 *
 * @param {import('zod').ZodType} schema
 * @returns {import('zod').ZodType}
 */
const sanitized = (schema) => schema.transform(sanitizeString);

// Query values arrive as strings. Page and limit clamp rather than reject, so
// `?limit=1000` keeps returning the maximum page size instead of erroring.
// When a value is absent (undefined) the .default() kicks in after the
// preprocess step, so missing params resolve to the documented defaults
// (page=1, limit=10) without any extra branching in the handlers.
const clampedInt = (fallback, min, max) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) return undefined;
      return Math.min(max, Math.max(min, parsed));
    }, z.number().int().min(min).max(max).optional())
    .default(fallback);

const paginationFields = {
  page: clampedInt(1, 1, Number.MAX_SAFE_INTEGER),
  limit: clampedInt(10, 1, 100),
};

// Opaque keyset-pagination continuation token. Only shape-checked here; the
// handlers own decoding and answer 400 on an unparseable cursor.
const cursorField = {
  cursor: z.string().trim().min(1).max(512).optional(),
};

// Lookup keys are passed to the database as-is, so they are only checked for
// type and length here. Format checking of addresses stays with StrKey in the
// handlers, which knows the real Stellar base32 alphabet and checksum.
const lookupString = z.string().trim().min(1).max(256);

const optionalLookupString = lookupString.optional();

module.exports = { sanitizeString, sanitized, clampedInt, paginationFields, cursorField, lookupString, optionalLookupString };
