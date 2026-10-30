# Refresh & Reconciliation

The backend periodically reads player and match state from the selected provider. Not all observations are immediately complete.

## Why values can be delayed

Providers may return incomplete match history, delayed LP changes or rate-limited responses. The backend maintains LP observation states and queues reconciliation work when a result cannot yet be resolved.

Match LP deltas can be `resolved`, `pending` or `unknown`. Do not treat pending or unknown deltas as confirmed results.

## Simplified flow

1. Refresh current player and ranked/match information.
2. Compare provider observations with the event participant's saved state.
3. Persist reliable values and queue unresolved work.
4. Retry reconciliation according to the backend's scheduling rules.
5. Recalculate cached leaderboard data and notify connected clients.

Useful code entry points include `backend/src/services/lp-observation-resolver.ts`, `lp-reconciliation.service.ts` and `backend/src/db/lp-reconciliation.ts`.

For investigation, prefer [Diagnostics CLI](../operations/diagnostics.md) over manual updates to database tables.
