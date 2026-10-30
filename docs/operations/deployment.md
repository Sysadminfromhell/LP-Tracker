# Deployment

Deploy the frontend, backend and persistent PostgreSQL database behind a trusted HTTPS reverse proxy.

```text
https://tracker.example.com/      -> frontend:80
https://tracker.example.com/api/* -> backend:3000
```

For Docker image names see [Installation](../getting-started/installation.md). Release, staging and main images use distinct tags in Woodpecker CI.

## Update checklist

1. Back up PostgreSQL and verify that restore is possible.
2. Record current image tags/digests and deployed commit.
3. Pull matching frontend/backend images.
4. Start the backend and let database migrations finish.
5. Start the frontend and check `/api/health`.
6. Verify leaderboard, admin login and monitoring.

## Security baseline

Use `NODE_ENV=production`, HTTPS and carefully scoped `TRUST_PROXY`. Keep PostgreSQL private. Protect Riot API keys, administrator bootstrap credentials and metrics tokens.

See [Configuration](../getting-started/configuration.md) and [Troubleshooting](troubleshooting.md).
