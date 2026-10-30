# LP Scoring

The currently released format is the LP-based event. Players are primarily ranked by event-relative LP gain.

## Core calculation

The leaderboard code uses a normalized rank score and subtracts any event LP penalty:

```text
event LP gain = current rank score - start rank score - LP penalty
```

Rank-score normalization matters across promotions and demotions. Simply subtracting two visible LP figures is not always equivalent.

## Win/loss and match observations

The leaderboard displays wins, losses and match data, but these are not a replacement for the current LP-event ranking. Individual match LP deltas can be `pending`, `resolved` or `unknown` during reconciliation. Remakes and LP-loss-prevention situations need special handling.

Configurable rules and League-style win/loss points belong to future roadmap work; they are **not** current LP-event scoring behavior.

See [Refresh & Reconciliation](reconciliation.md) and [Roadmap](../project/roadmap.md).
