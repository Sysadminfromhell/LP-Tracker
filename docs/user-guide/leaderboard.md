# Leaderboard

Open the application root (`/`) to view the current event leaderboard.

## Displayed information

The leaderboard shows event standings, event-relative LP gain, current ranked status, win/loss figures, recent matches and update information. LP gained during an event is not necessarily the same as the visible LP number shown by the League client.

Current LP events are primarily ordered by event LP gain. Event penalties may reduce the computed result; see [LP Scoring](../event-system/scoring.md).

## Live information

The frontend receives update notifications through Server-Sent Events. The upstream data provider and reconciliation queue can still introduce delays. A match marked pending or unknown does not yet have a confirmed individual LP change.

For older results visit [Player & Event History](history.md), or see [Refresh & Reconciliation](../event-system/reconciliation.md) for technical details.
