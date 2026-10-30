# Configuration

The source of truth for environment settings is [`backend/.env.example`](https://github.com/Sysadminfromhell/LP-Tracker/blob/main/backend/.env.example). Do not commit credentials.

## Database and application

```dotenv
NODE_ENV=production
DATABASE_HOST=postgres.example.internal
DATABASE_PORT=5432
DATABASE_NAME=lp_tracker
DATABASE_USER=lp_tracker
DATABASE_PASSWORD=change-me
```

`DATABASE_PORT` defaults to `5432`. Use a dedicated database role with minimum required privileges.

## Bootstrap administrator

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
```

These credentials create an initial administrator if no administrator exists; they do not overwrite an existing account. Restarting the backend invalidates existing admin sessions.

The optional `npm --prefix backend run db:bootstrap` command uses `DATABASE_ADMIN_USER` and `DATABASE_ADMIN_PASSWORD`. Do not provide database-superuser credentials to the normal runtime unless your deployment genuinely needs them.

## League provider

```dotenv
# Default when omitted: opgg
LEAGUE_DATA_PROVIDER=opgg

# Alternatively:
# LEAGUE_DATA_PROVIDER=riot
# RIOT_API_KEY=your-api-key
```

See [League Data Providers](../operations/providers.md).

## Operational settings

- `TRUST_PROXY` must identify only trusted proxy IPs or CIDR ranges; avoid the broad value `true`.
- `METRICS_TOKEN` enables `/metrics` and requires Bearer authentication. When omitted, the endpoint is not registered.
- `LOG_LEVEL` controls application logging (refer to the example file for allowed values).

Prefer secret management or orchestrator secrets for sensitive settings.
