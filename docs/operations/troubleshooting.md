# Troubleshooting

## Frontend loads, API fails

Check backend logs and `/api/health`. Verify reverse-proxy routing of `/api/*` to port `3000` and database connectivity.

## Database connection error

Check `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, network connectivity and PostgreSQL `pg_hba.conf`. Do **not** delete the data volume as a first troubleshooting step.

## Player data is not updating

Inspect the authenticated admin health endpoint and backend logs. The provider may be delayed or rate-limited. Run `diagnose -- provider` and `diagnose -- queue`.

## Admin login stopped after restart

Existing admin sessions are invalidated on backend restart. Sign in again.

## Version displays `dev`

The backend image was likely built without a `GIT_COMMIT_SHA` build argument. CI normally supplies it; local builds need an explicit value.

## OBS overlay is empty

Verify the event/player route, API connectivity and recorded data for the selected participant.

For more detail see [Diagnostics CLI](diagnostics.md) or the [issue tracker](https://github.com/Sysadminfromhell/LP-Tracker/issues).
