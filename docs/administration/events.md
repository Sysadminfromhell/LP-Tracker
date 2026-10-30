# Event Management

Use the admin interface to schedule an event, select participants and manage event state.

## Typical workflow

1. Create a named event with valid future start and end times.
2. Select tracked participants.
3. Review the scheduled event.
4. Allow the backend to activate it at the configured start.
5. Track refreshes and live standings.
6. End/finalize the event and review saved history.

The current admin API implements event creation/updates, naming, selected participant operations and event penalty management under `/api/admin/events`.

## Status model

The database type contains `draft`, `scheduled`, `active` and `ended`. The normal scheduled workflow is **scheduled → active → ended**. See [Event Lifecycle](../event-system/lifecycle.md).

Current released LP events use LP-based scoring, not the League-style points format proposed on the future [Roadmap](../project/roadmap.md). See [LP Scoring](../event-system/scoring.md).
