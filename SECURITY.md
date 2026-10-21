# Security Policy

Stellar Tags is a public-facing payment platform, and we take the security of our
users and their funds seriously. This document explains which versions are
supported, how to report a vulnerability responsibly, and what you can expect
from us after you do.

## Supported Versions

Security fixes are provided for the following versions:

| Version | Supported |
| --- | --- |
| `main` (latest) | :white_check_mark: |
| Latest tagged release | :white_check_mark: |
| Older tagged releases | :x: |

If you are running a fork or an older release, please upgrade to the latest
release before reporting an issue, as it may already be fixed.

## Reporting a Vulnerability

**Please do not open a public GitHub issue, pull request, or discussion for
security vulnerabilities.** Public disclosure before a fix is available puts
users at risk.

Instead, report vulnerabilities privately using either of the following:

1. **GitHub Private Security Advisory (preferred)** — use the
   ["Report a vulnerability"](https://github.com/Stellar-Tags/Stellar-Tags/security/advisories/new)
   button on the repository's **Security** tab. This keeps the report private
   and lets us collaborate on a fix and advisory in one place.
2. **Email** — send your report to **security@stellartags.dev**.

### What to include

To help us triage quickly, please include as much of the following as possible:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof-of-concept.
- Affected version, commit hash, or environment (network, browser, etc.).
- Any suggested remediation.

If you wish to encrypt your report, you may request our PGP key by email and we
will provide it before you send sensitive details.

## Response Times

We aim to meet the following commitments for all valid reports:

| Stage | Target |
| --- | --- |
| Acknowledgement of report | within **48 hours** |
| Initial assessment / triage | within **5 business days** |
| Fix or mitigation for confirmed issues | within **14 days** |
| Public disclosure (coordinated) | after a fix is released, by mutual agreement |

We will keep you informed of our progress throughout the process and credit you
in the advisory unless you prefer to remain anonymous.

## Bug Bounties

We do **not** currently operate a paid bug bounty programme. We are grateful for
responsible disclosures and will publicly credit reporters (with permission),
but we cannot offer monetary rewards at this time.

## Scope

This policy applies to the Stellar Tags repository, including the frontend,
backend, and Soroban contracts. Vulnerabilities in third-party dependencies
should be reported upstream, though we appreciate a heads-up if they affect us.

Thank you for helping keep Stellar Tags and its users safe.
