# Monitoring

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Basic application/build status |
| `GET /api/admin/health` | Admin session | Database, event, provider and scheduler details |
| `GET /metrics` | Bearer token if enabled | Prometheus-compatible metrics |

The metrics endpoint is disabled when `METRICS_TOKEN` is not configured.

## Example Prometheus scrape

```yaml
scrape_configs:
  - job_name: lp-tracker
    authorization:
      type: Bearer
      credentials_file: /run/secrets/lp_tracker_metrics_token
    static_configs:
      - targets:
          - lp-tracker-backend:3000
```

Keep metrics access on a trusted internal network in addition to token authentication.

Available metrics cover player/cache state, provider status, scheduler/refresh behavior and relevant counters. For application-state investigation, see [Diagnostics CLI](diagnostics.md).
