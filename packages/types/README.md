# @refund/types

Shared TypeScript types and generated Soroban contract bindings for the refund contract.

## Smart Contract

### `get_refund_balance(user: Address, token: Address) -> i128`

Returns the refund balance for `user` in `token`.

> **Auth required:** `get_refund_balance` now calls `user.require_auth()`. Only the
> account holder (or a delegated signer) can query their own refund balance. Callers
> must supply a valid authorization entry for `user`; invoking without auth returns
> an auth error.

```ts
// The generated client requires the `user` auth entry to be present.
const balance = await contract.get_refund_balance({ user, token });
```

### `withdraw_refund` / `claim_all_refunds`

These already require auth and are unchanged.

## Regenerating bindings

After contract changes, regenerate the TypeScript bindings so the client
invocation reflects the current auth requirements.
