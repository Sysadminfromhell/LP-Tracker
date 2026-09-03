# Contributing to LP-Tracker

Thanks for your interest in improving LP-Tracker.

The goal of this document is to keep development predictable without turning contribution into unnecessary process. The `main` branch represents the current stable code line; changes should be developed and reviewed on dedicated branches.

---

## Development workflow

Start from an up-to-date `main` branch:

```bash
git switch main
git pull --ff-only
git switch -c feat/my-change
```

Use a branch that describes the purpose of the change.

Recommended prefixes:

| Prefix | Purpose |
|---|---|
| `feat/` | New functionality |
| `fix/` | Bug fix |
| `docs/` | Documentation |
| `refactor/` | Internal refactoring |
| `chore/` | Maintenance |
| `test/` | Test-only changes |

Keep each branch and Pull Request focused on one logical change.

---

## Repository layout

```text
backend/     Fastify / Node.js backend
frontend/    React / Vite frontend
.woodpecker/ CI build definitions
Dockerfile.backend
Dockerfile.frontend
```

The backend owns database access, event state and League provider integrations. The frontend communicates only with the LP-Tracker API.

When adding provider-specific behavior, keep it behind the provider abstraction instead of coupling provider details into unrelated application code.

---

## Setup

Install dependencies:

```bash
npm --prefix backend ci
npm --prefix frontend ci
```

Create a local backend environment file:

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Configure PostgreSQL and any provider credentials required for your development environment.

Start the backend:

```bash
npm --prefix backend run dev
```

Start the frontend in another terminal:

```bash
npm --prefix frontend run dev
```

---

## Database changes

Database schema changes must be delivered through a migration in `backend/migrations`.

Do not silently modify an existing migration that may already have been applied to deployed databases. Add a new migration for forward changes.

Code that depends on a schema change must be shipped together with the migration that introduces it.

Before submitting database-related changes, verify both a clean database path and an existing/upgraded database path where practical.

Never include production database dumps or credentials in the repository.

---

## Environment variables

New runtime configuration should be documented in:

```text
backend/.env.example
```

If a new variable changes deployment or operator behavior, update `README.md` as well.

Do not commit real `.env` files, passwords, Riot API keys, session tokens or other credentials.

Build metadata such as `GIT_COMMIT_SHA` should remain build/CI metadata rather than normal user configuration unless there is a strong reason to expose it as runtime configuration.

---

## Code quality checks

Before opening a Pull Request, run the relevant checks.

### Backend

```bash
npm --prefix backend run test
npm --prefix backend run typecheck
npm --prefix backend run build
```

### Frontend

```bash
npm --prefix frontend run build
npm --prefix frontend run lint
```

### Repository

```bash
git diff --check
```

A Pull Request should not intentionally introduce failing tests, TypeScript errors, lint errors or whitespace errors.

---

## Tests

Add or update tests when changing behavior that can be verified automatically.

Tests are especially valuable for:

- Event lifecycle transitions
- Leaderboard calculations
- Player refresh behavior
- Authentication and admin routes
- League provider implementations
- Riot rate-limit behavior
- Monitoring and health output
- Failure/retry behavior

Bug fixes should include a regression test when practical.

---

## Commit messages

Use concise commit messages that describe the change.

Examples:

```text
feat: add application monitoring metrics
fix: avoid double counting Riot rate limits
docs: update deployment guide
chore: refresh dependencies
```

Conventional-style prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:` and `chore:` are preferred.

---

## Pull Requests

A good Pull Request should explain:

- What changed
- Why the change is needed
- How it was tested
- Whether it changes configuration
- Whether it includes a database migration
- Whether it changes the UI

For visible UI changes, screenshots or a short recording are helpful.

Keep unrelated refactoring out of focused bug fixes or feature changes whenever possible.

Resolve merge conflicts on the feature branch instead of making emergency edits directly on `main`.

---

## Frontend changes

Keep normal leaderboard behavior separate from OBS overlay behavior unless a feature intentionally affects both.

When changing API response types used by the frontend, update the corresponding TypeScript interfaces and verify both frontend build and backend tests.

Avoid adding dependencies for small UI elements when a simple implementation already fits the existing codebase.

---

## Provider changes

LP-Tracker currently supports OP.GG MCP and Riot Games API implementations behind the League data provider abstraction.

Provider-specific rate limits, authentication and response formats should stay inside provider-specific code whenever possible.

Do not make the frontend communicate directly with OP.GG or Riot APIs.

When changing Riot API behavior, consider:

- HTTP 429 handling
- Retry behavior
- Application rate-limit headers
- Request pacing
- Development/Personal key limits

---

## Security

Do not publish credentials, API keys, tokens, cookies, database dumps or sensitive production logs in issues or Pull Requests.

Potential security vulnerabilities should be reported according to [SECURITY.md](SECURITY.md), not through a public issue.

---

## Documentation

Update documentation when a change affects:

- Deployment
- Environment variables
- Upgrade procedure
- Provider configuration
- Database requirements
- Monitoring
- User-visible workflows

The README should remain focused on operating, deploying, updating and using LP-Tracker. Detailed contribution policy belongs in this file.
