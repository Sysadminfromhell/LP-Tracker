# Event Lifecycle

An event measures player progression relative to starting snapshots over a defined period.

## Status

The database event type includes `draft`, `scheduled`, `active` and `ended`. The standard scheduler path follows:

```text
scheduled -> active -> ended
```

`draft` exists in the underlying status type but is not the same as the normal scheduled state.

## Transitions

- **Scheduled:** Timing and participants are configured.
- **Active:** Starting ranked snapshots anchor event-relative calculations. Refresh jobs collect player/match data.
- **Ended:** Final participant state is recorded; the application attempts final refreshes before completion.

Upstream provider delays or unresolved match observations can affect how quickly all data becomes complete. Read [Refresh & Reconciliation](reconciliation.md) for details.
