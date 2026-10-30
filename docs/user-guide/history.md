# Player & Event History

LP-Tracker preserves completed event results and player history separately from the latest live leaderboard.

| Page | Route |
| --- | --- |
| Event history | `/history` |
| Event details | `/history/:eventId` |
| Player details | `/players/:playerId` |

Replace route parameters with the numeric IDs from your installation.

Event starting snapshots and final event state are different from a player's current ranked data. Historical match LP observations can be pending or unknown while the backend resolves incomplete provider data.

Related public API routes include `/api/events/history`, `/api/events/history/:eventId`, `/api/players/:id` and per-event player details. See [REST API](../development/api.md).

For the underlying logic read [Event Lifecycle](../event-system/lifecycle.md) and [LP Scoring](../event-system/scoring.md).
