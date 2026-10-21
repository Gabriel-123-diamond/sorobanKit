# Webhook Signature Verification

Every webhook delivery from the Stellar Tags payment platform is signed so that merchants can verify the payload originated from us and was not tampered with in transit.

## Signature Headers

Each delivery includes the signature in **two** HTTP headers:

| Header | Status | Description |
| --- | --- | --- |
| `X-Webhook-Signature` | **Canonical** | The primary header. Always present. Use this header for verification. |
| `X-Stellar-Tags-Signature` | **Deprecated** | Backward-compatible alias. Always present for now, but will be removed in a future release. |

Both headers carry the **same** HMAC signature value. You may read either one, but you should migrate to `X-Webhook-Signature` as soon as possible.

### Which header takes precedence?

If both headers are present (which is the case for every delivery today), they contain identical values, so verification will succeed regardless of which one you read. However:

- **`X-Webhook-Signature` is authoritative.** If the two headers ever disagree (for example, due to a proxy or middleware rewriting one of them), you **must** verify against `X-Webhook-Signature` and reject the request if it does not match.
- **`X-Stellar-Tags-Signature` is a fallback only.** Read it only if `X-Webhook-Signature` is absent, and treat a request that carries only the alias as a signal that you are running against a deprecated integration path.

> **Security note:** Do not disable signature verification because you are unsure which header to read. Both headers are always sent, and `X-Webhook-Signature` is always the correct one to check.

## Deprecation Notice for `X-Stellar-Tags-Signature`

The `X-Stellar-Tags-Signature` header is **deprecated** and is retained only for backward compatibility with older integrations.

- **Target removal version:** `v2.0.0`
- **Target removal date:** `2026-01-01`

After the removal date, deliveries will include only `X-Webhook-Signature`. Integrations that read only the alias header will stop verifying successfully at that point. Migrate to `X-Webhook-Signature` before the removal date.

When a merchant request is observed using only the alias header, the platform emits a deprecation warning in its logs to help identify integrations that still need to migrate.

## Verifying a Signature

1. Read the raw request body **before** any JSON parsing or middleware that may mutate it.
2. Read the signature from `X-Webhook-Signature` (fall back to `X-Stellar-Tags-Signature` only if the canonical header is missing).
3. Compute the HMAC of the raw body using your webhook signing secret and the algorithm documented in the API reference.
4. Compare the computed value to the header value using a **constant-time** comparison.
5. Reject the request if the values do not match.

### Example (Node.js)

```js
const crypto = require('crypto');

function verifyWebhook(rawBody, headers, secret) {
  const signature =
    headers['x-webhook-signature'] ||
    headers['x-stellar-tags-signature']; // deprecated fallback

  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}
```

## Migration Checklist

- [ ] Update verification code to read `X-Webhook-Signature`.
- [ ] Keep the `X-Stellar-Tags-Signature` fallback only until the removal date (`2026-01-01`, `v2.0.0`).
- [ ] Ensure the raw request body is used for HMAC computation.
- [ ] Use constant-time comparison for signature checks.
- [ ] Remove any code paths that skip verification when the canonical header is missing.