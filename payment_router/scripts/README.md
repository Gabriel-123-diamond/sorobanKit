# payment_router/scripts

Development utilities for the `payment_router` package. These scripts are
**not** part of the runtime, CI pipeline, or any documented build target —
they exist only to help contributors during development.

## `extract_tests.py`

Extracts test cases from the payment router sources into a standalone form
for local inspection. It was previously left in the root of `payment_router/`,
which made its purpose unclear to new contributors.

### Usage

Run from the repository root:

```sh
python payment_router/scripts/extract_tests.py
```

### Notes

- This is a development-only helper; it is not imported by the package.
- If you find it is no longer needed, remove it and note the removal in the
  changelog rather than leaving it undocumented.
