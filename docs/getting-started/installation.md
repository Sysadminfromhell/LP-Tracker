# Installation

LP-Tracker runs as a React frontend, Fastify backend and PostgreSQL database, normally behind an HTTPS reverse proxy.

## Requirements

- Docker Engine (with Docker Compose, Docker Swarm or equivalent)
- PostgreSQL with persistent storage
- A reverse proxy such as Traefik or Nginx
- Connectivity to the configured League data provider

## Docker images

The [Woodpecker pipelines](https://github.com/Sysadminfromhell/LP-Tracker/tree/main/.woodpecker) define these image tags:

| Environment | Frontend | Backend |
| --- | --- | --- |
| Release (published on a version tag) | `safhdev/lp-tracker:frontend` | `safhdev/lp-tracker:backend` |
| Staging | `safhdev/lp-tracker:frontend-staging` | `safhdev/lp-tracker:backend-staging` |
| Main branch | `safhdev/lp-tracker:frontend-main` | `safhdev/lp-tracker:backend-main` |

For a released version:

```bash
docker pull safhdev/lp-tracker:frontend
docker pull safhdev/lp-tracker:backend
```

The frontend serves on port `80`, and the backend serves on port `3000`. Pin a release-specific tag or digest for reproducible deployments, and deploy matching frontend and backend versions.

## Routing

```text
https://tracker.example.com/      -> frontend:80
https://tracker.example.com/api/* -> backend:3000
```

Keep the database private. Configure environment variables using the [Configuration](configuration.md) guide.

## First startup

1. Prepare PostgreSQL and the application database/user.
2. Supply backend configuration and persistent database storage.
3. Start PostgreSQL, backend and frontend.
4. Verify `GET /api/health`.
5. Visit `/admin`, sign in with the bootstrapped administrator and secure the account.
6. Configure tracked players and a scheduled event.

Database migrations run during backend startup. Always back up PostgreSQL before upgrading. Continue with [Deployment](../operations/deployment.md).
