# Installation

KRYVEX runs as a React frontend, Fastify backend and PostgreSQL database, normally behind an HTTPS reverse proxy.

## Requirements

- Docker Engine (with Docker Compose, Docker Swarm or equivalent)
- PostgreSQL with persistent storage
- A reverse proxy such as Traefik or Nginx
- Connectivity to the configured League data provider

## Docker images

The [Woodpecker pipelines](https://github.com/Sysadminfromhell/KRYVEX/tree/main/.woodpecker) define these image tags:

| Environment | Frontend | Backend |
| --- | --- | --- |
| Release (published on a version tag) | `safhdev/kryvex:frontend` | `safhdev/kryvex:backend` |
| Staging | `safhdev/kryvex:frontend-staging` | `safhdev/kryvex:backend-staging` |
| Main branch | `safhdev/kryvex:frontend-main` | `safhdev/kryvex:backend-main` |

For a released version:

```bash
docker pull safhdev/kryvex:frontend
docker pull safhdev/kryvex:backend
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
