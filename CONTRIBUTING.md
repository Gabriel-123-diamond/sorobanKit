# Contributing to Stellar Tags

Thanks for your interest in improving Stellar Tags! This guide walks you through the development workflow, conventions, and review process so you can get productive quickly.

## Prerequisites

- **Node.js** 18+ and **npm** (for the frontend)
- **Rust** (stable toolchain) and **Cargo** (for the backend)
- **Git**

## Local Setup

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/stellar-tags.git
   cd stellar-tags
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Build the backend:
   ```bash
   cargo build
   ```
4. Start the development servers as described in the [README](./README.md).

## Branching Strategy

- Branch off `main` for all work.
- Use a descriptive, prefixed branch name:
  - `feat/<short-description>` for new features
  - `fix/<short-description>` for bug fixes
  - `docs/<short-description>` for documentation
  - `chore/<short-description>` for maintenance
- Keep branches focused on a single issue or change.

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Example:

```
feat(tags): add pagination to tag listing
```

## Code Style

- **Frontend (TypeScript/JavaScript):** run ESLint before committing:
  ```bash
  npm run lint
  ```
- **Backend (Rust):** format and lint with Clippy:
  ```bash
  cargo fmt
  cargo clippy -- -D warnings
  ```
- Match the existing structure, naming, and patterns in the codebase.

## Pre-commit Hook

This repository uses [Husky](https://typicode.github.io/husky/) to run checks before each commit (see `.husky/pre-commit`). The hook runs:

1. **Lint** — `npm run lint` (ESLint).
2. **Unit tests** — `npm run test:unit`, which runs Jest against `tests/unit` only (`--testPathPattern=tests/unit --passWithNoTests`).

The hook is intentionally limited to a fast subset of tests so it completes in under 30 seconds on a modern developer machine. Integration and e2e tests, as well as Rust tests, are **not** run in the hook — they are covered by CI. A failing unit test will block the commit; fix the failure (or, if you must, bypass with `git commit --no-verify`, though CI will still enforce the checks).

## Tests

All changes should include or update tests where appropriate. Run the full test suite before opening a PR:

```bash
# Frontend
npm test

# Backend
cargo test
```

## Pull Requests

1. Push your branch to your fork and open a PR against `main`.
2. Fill out the PR template (`.github/pull_request_template.md`) completely.
3. Link the issue your PR addresses (e.g. `Closes #123`).
4. Ensure CI passes and all tests are green.
5. Respond to review feedback promptly. A maintainer will review and merge once approved.

## Questions?

If anything here is unclear, open an issue or start a discussion — we're happy to help.
