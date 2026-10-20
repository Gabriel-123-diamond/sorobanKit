'use strict';

const { z } = require('zod');
const { sanitized, clampedInt, paginationFields, cursorField, optionalLookupString } = require('./common');

/**
 * POST /register body.
 *
 * The bare username is validated here; the server appends the federation
 * suffix afterwards. Addresses are only required to be non-empty strings at
 * this layer because the handler runs the authoritative StrKey check and
 * answers 400 with a Stellar-specific message.
 */
const registerBodySchema = z
  .object({
    username: z
      .string({ error: 'username is required' })
      .trim()
      .min(3, 'username must be between 3 and 20 characters')
      .max(20, 'username must be between 3 and 20 characters')
      .regex(/^[a-zA-Z0-9]+$/, 'username must contain only letters and numbers'),
    // Only required to be a non-empty string: StrKey in the handler is the
    // authoritative format check and answers 400 with a Stellar-specific
    // message. Adding a length bound here would reject payloads before they
    // reach that check, which the injection-safety tests rely on.
    address: z
      .string({ error: 'address is required' })
      .trim()
      .min(1, 'address cannot be empty'),
    // Memo and signature fields are only shape-checked here. validateMemo owns
    // the cross-field pairing and per-type format rules (and their 400
    // responses), and an empty signature legitimately means "unsigned".
    // Free-text fields are sanitized against XSS payloads before reaching the
    // handler layer.
    memo_type: sanitized(z.string().trim().optional()),
    memo: sanitized(z.string().trim().optional()),
    signature: z.string().trim().optional(),
    signerAddress: z.string().trim().optional(),
  })
  .loose();

/** GET /federation query. */
const federationQuerySchema = z
  .object({
    q: z
      .string({ error: "Missing 'q' parameter" })
      .trim()
      .min(1, "Missing 'q' parameter")
      .max(256)
      .superRefine((value, ctx) => {
        // When the request is a name lookup (no type=id), the q parameter must
        // follow the federation address format: <username>*<domain>.
        // Reject queries that are missing the * separator, have an empty
        // username part (e.g. "*domain"), or have an empty domain part
        // (e.g. "alice*").  type=id queries pass a raw Stellar address, so
        // only apply the check when the value looks like a name (contains *).
        if (value.includes('*')) {
          const starIndex = value.indexOf('*');
          const username = value.slice(0, starIndex);
          const domain = value.slice(starIndex + 1);
          if (username.length === 0 || domain.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Invalid federation address format. Expected <username>*<domain> (e.g. alice*example.com)",
            });
          }
        }
      }),
    type: z
      .enum(['id', 'name'], "Unsupported query type. Supported types: 'id', 'name'")
      .optional(),
  })
  .loose();

/**
 * GET /lookup query. Exactly one of `address` (exact match) or `search`
 * (paginated) drives the handler, so at least one must be present.
 */
const lookupQuerySchema = z
  .object({
    address: optionalLookupString,
    search: optionalLookupString,
    all: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    ...paginationFields,
    ...cursorField,
  })
  .loose()
  .refine((value) => Boolean(value.address || value.search), {
    error:
      "Missing required parameter: provide 'address' for exact lookup or 'search' for paginated search",
    path: ['address'],
  });

/** GET /users query. Both filters are optional; listing everything is valid. */
const usersQuerySchema = z
  .object({
    search: optionalLookupString,
    ...paginationFields,
    ...cursorField,
  })
  .loose();

/** GET /accounts/:account/payments query. The account itself is checked with
 * StrKey in the handler, which knows the real Stellar key format. */
const accountPaymentsQuerySchema = z
  .object({
    limit: clampedInt(25, 1, 100), // default 25, min 1, max 100
    cursor: z.string().trim().min(1).optional(),
    order: z.enum(['asc', 'desc']).catch('desc'),
  })
  .loose();

/** GET /users/:username/activity query. Dates are only shape-checked here;
 * the handler parses them so it can report which bound was unparseable. */
const activityQuerySchema = z
  .object({
    ...paginationFields,
    startDate: z.string().trim().min(1).max(64).optional(),
    endDate: z.string().trim().min(1).max(64).optional(),
  })
  .loose();

/** POST /auth/verify-email and /auth/verify-email/confirm */
const verifyEmailBodySchema = z
  .object({
    email: z.string({ error: 'email is required' }).trim().email('a valid email is required'),
  })
  .loose();

const verifyEmailConfirmBodySchema = verifyEmailBodySchema.extend({
  code: z
    .string({ error: 'code is required' })
    .trim()
    .regex(/^\d{6}$/, 'code must be a 6-digit number'),
});

module.exports = { registerBodySchema, federationQuerySchema, lookupQuerySchema, usersQuerySchema, accountPaymentsQuerySchema, activityQuerySchema, verifyEmailBodySchema, verifyEmailConfirmBodySchema };
