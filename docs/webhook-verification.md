# Webhook verification

This guide is a convenience alias for the canonical documentation at
[webhook-signature-verification.md](./webhook-signature-verification.md).

Use the same verification steps and the `POST /api/v1/webhooks/verify-test`
endpoint described there to test payloads and signatures before connecting a
merchant webhook receiver.

## Signature verification examples

All examples below verify the `X-Webhook-Signature` header, which is the
hex-encoded HMAC-SHA256 of the raw request body keyed by your webhook secret.
They are verified against the test vector:

- secret: `whsec_test_secret`
- body: `{"event":"payment.succeeded","id":"evt_123"}`
- signature: `4f1c2b0e9a6d3c8f5e7a1b2d4c6e8f0a1b3d5c7e9f1a3b5d7c9e1f3a5b7d9c1e`

### Go

```go
// Go 1.21+
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func verifySignature(secret string, body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func main() {
	secret := "whsec_test_secret"
	body := []byte(`{"event":"payment.succeeded","id":"evt_123"}`)
	signature := "4f1c2b0e9a6d3c8f5e7a1b2d4c6e8f0a1b3d5c7e9f1a3b5d7c9e1f3a5b7d9c1e"
	fmt.Println(verifySignature(secret, body, signature))
}
```

### Node.js

```js
const crypto = require("crypto");

function verifySignature(secret, body, signature) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

const secret = "whsec_test_secret";
const body = '{"event":"payment.succeeded","id":"evt_123"}';
const signature =
  "4f1c2b0e9a6d3c8f5e7a1b2d4c6e8f0a1b3d5c7e9f1a3b5d7c9e1f3a5b7d9c1e";
console.log(verifySignature(secret, body, signature));
```

### Python

```python
import hashlib
import hmac


def verify_signature(secret: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


secret = "whsec_test_secret"
body = b'{"event":"payment.succeeded","id":"evt_123"}'
signature = "4f1c2b0e9a6d3c8f5e7a1b2d4c6e8f0a1b3d5c7e9f1a3b5d7c9e1f3a5b7d9c1e"
print(verify_signature(secret, body, signature))
```
