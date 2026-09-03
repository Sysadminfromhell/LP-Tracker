# Security Policy

Security reports are taken seriously. Please avoid public disclosure of a vulnerability until it has been reviewed and, where necessary, fixed.

---

## Supported versions

Security fixes are intended for the latest released LP-Tracker version.

Older releases, development branches and historical commits may not receive security updates. Operators should keep production deployments on a maintained release or a known reviewed commit.

---

## Reporting a vulnerability

**Do not open a public GitHub issue for an exploitable security vulnerability.**

Preferred reporting method:

1. Use GitHub's private vulnerability reporting / Security Advisory feature for the LP-Tracker repository when available.
2. If private vulnerability reporting is not available, contact the repository owner privately through GitHub before publishing technical details.

Repository:

https://github.com/Sysadminfromhell/LP-Tracker

Please include enough information to reproduce and assess the issue:

- Affected LP-Tracker version or Git commit
- Affected component (`frontend`, `backend`, provider, deployment, etc.)
- Vulnerability type and expected impact
- Reproduction steps or proof of concept
- Relevant configuration without real credentials
- Logs or error messages with secrets removed
- Any suggested mitigation, if known

Please do not include real passwords, API keys, session tokens, database contents or other unrelated personal/sensitive data.

---

## Examples of security issues

Examples that should be reported privately include:

- Authentication or authorization bypass
- Admin session compromise
- Credential or API-key disclosure
- SQL injection
- Command injection
- Server-side request forgery
- Cross-site scripting with meaningful security impact
- Cross-site request forgery bypasses
- Exposure of private application or database data
- Unsafe secret handling
- Vulnerabilities that allow modification of event/player data without authorization
- Dependency vulnerabilities that are practically exploitable in LP-Tracker

Normal bugs, UI issues, provider outages and feature requests can be reported through normal project channels when they do not expose sensitive information or create a security impact.

---

# Deployment security

LP-Tracker is self-hosted software. The operator is responsible for securing the surrounding infrastructure.

## Use production mode

Production deployments should use:

```env
NODE_ENV=production
```

Production mode enables production-specific request and cookie security behavior.

---

## Protect credentials

Never commit real credentials to Git.

Protect at least:

- `DATABASE_PASSWORD`
- `DATABASE_ADMIN_PASSWORD`
- `ADMIN_PASSWORD`
- `RIOT_API_KEY`

Prefer Docker secrets, Swarm secrets, Kubernetes Secrets, a secret manager or an equivalent mechanism where available.

The committed `backend/.env.example` file must contain examples/placeholders only.

---

## Database privileges

The normal LP-Tracker database user should have access only to the application database it requires.

Do not run the application permanently with a PostgreSQL superuser account.

`DATABASE_ADMIN_USER` and `DATABASE_ADMIN_PASSWORD` are intended for database bootstrap operations and are not required for normal runtime once the database and application role exist.

Do not expose PostgreSQL directly to the public internet.

---

## Reverse proxy and TLS

Production traffic should be served through HTTPS.

Terminate TLS at a trusted reverse proxy or ingress layer and route application traffic to the frontend/backend over trusted internal networks.

Expected application routing is:

```text
/       -> frontend
/api/*  -> backend
```

---

## Metrics endpoint

The backend exposes Prometheus-compatible metrics at:

```text
/metrics
```

The metrics endpoint is intended for monitoring and should preferably be restricted to an internal monitoring network, Prometheus instance or reverse-proxy allowlist.

Avoid exposing operational diagnostics publicly when they are not required.

---

## Admin accounts and sessions

Use a strong, unique administrator password.

The initial admin credentials are used only when no administrator exists. Do not leave example credentials unchanged in a real deployment.

LP-Tracker invalidates existing admin sessions during backend startup. An administrator must sign in again after a backend restart.

Do not share admin session cookies or include them in public logs/screenshots.

---

## Riot API keys

Treat Riot API keys as secrets.

Do not commit them, print them in logs or expose them to the frontend.

The frontend must never call the Riot API directly with a private server-side API key.

Rotate a Riot API key if you believe it has been exposed.

---

## Updates and backups

Before updating production:

- Back up PostgreSQL
- Record the currently deployed version/commit/image digest
- Review release or commit changes
- Apply the update
- Verify `/api/health`
- Verify authentication and critical workflows

Database migrations run during backend startup, so a tested database backup is particularly important before upgrades that contain schema changes.

---

## Dependency security

Dependency and container-image vulnerabilities should be reviewed regularly.

Automated dependency/CVE checks are useful, but an automated alert is not proof that the application is exploitable. Assess the affected package, version, runtime path and exposure before assigning severity.

Security updates should receive priority over unrelated feature work when exploitation is credible.

---

## Coordinated disclosure

Please allow reasonable time to investigate, reproduce and fix a vulnerability before public disclosure.

After a fix is available, security-impacting changes should be documented clearly enough for operators to understand whether they need to update their deployment.
