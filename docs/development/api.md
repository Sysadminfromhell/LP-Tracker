# REST API & Live Updates

Fastify handlers are defined in `backend/src/routes`. The route schemas and shared contracts are authoritative for payload fields and validation.

## Public routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/leaderboard` | Current leaderboard |
| GET | `/api/event` | Current event data |
| GET | `/api/events/history` | Completed events |
| GET | `/api/events/history/:eventId` | One historical event |
| GET | `/api/players/:id` | Player details |
| GET | `/api/players/:id/events/:eventId` | Player's event details |
| GET | `/api/health` | Public health |
| GET | `/api/live` | SSE live updates |

Additional public match-detail routes exist in `public.routes.ts`.

## Admin routes

`/api/admin/*` covers login, logout, administrator identity, events, players, health and database management. Endpoints requiring admin permissions use authenticated sessions.

## Metrics

`GET /metrics` is independent of `/api/*` and is only registered when `METRICS_TOKEN` is set; it requires Bearer authentication.

This page is a route overview, not a generated OpenAPI specification. Review code and runtime schemas before developing integrations.

See [Monitoring](../operations/monitoring.md).
