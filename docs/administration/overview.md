# Administration

Open `/admin` to manage the LP-Tracker installation.

Administrators can manage tracked League players, event schedules and participants, refresh actions, profile information, legal pages and selected database maintenance features.

## Authentication

The backend manages authenticated admin sessions. Existing sessions are intentionally invalidated when the backend restarts; a new login is then required.

## Database maintenance

Advanced database maintenance options can delete or change stored application data. Back up PostgreSQL and review what a command affects before performing destructive operations. The read-only [Diagnostics CLI](../operations/diagnostics.md) is preferable when merely inspecting state.

Continue with [Event Management](events.md) and [Privacy & Legal Pages](legal.md).
