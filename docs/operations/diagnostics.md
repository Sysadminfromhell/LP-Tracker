# Diagnostics CLI

The diagnostics CLI inspects state without intentionally modifying the database.

## Source checkout

```bash
npm --prefix backend run diagnose -- summary
npm --prefix backend run diagnose -- db
npm --prefix backend run diagnose -- event
npm --prefix backend run diagnose -- player 7
npm --prefix backend run diagnose -- queue
npm --prefix backend run diagnose -- provider
```

Add `--json` to request machine-readable output:

```bash
npm --silent --prefix backend run diagnose -- summary --json
```

## Container

```bash
docker exec <backend-container> node dist/cli/diagnostics-cli.js summary
```

In Swarm, first locate the backend task/container for your service.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Successful, including nonfatal warnings |
| `1` | Integrity errors detected |
| `2` | Usage error or diagnostic tool failure |

Warnings intentionally return `0`; they should still be investigated where relevant. Avoid modifying reconciliation or event tables just to silence a warning.

See [Troubleshooting](troubleshooting.md).
