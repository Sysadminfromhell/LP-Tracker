# League Data Providers

The backend implements a shared provider abstraction in `backend/src/providers`.

| `LEAGUE_DATA_PROVIDER` | Provider | Extra setting |
| --- | --- | --- |
| `opgg` | OP.GG MCP | None |
| `riot` | Riot Games API | `RIOT_API_KEY` |

The provider defaults to `opgg` when unset.

## OP.GG

No provider-specific configuration is required. The availability and completeness of upstream information can still affect how quickly the application updates.

## Riot API

```dotenv
LEAGUE_DATA_PROVIDER=riot
RIOT_API_KEY=your-api-key
```

Development/personal keys can have restrictive rate limits. The Riot provider includes pacing and HTTP `429` retry behavior, so larger events can refresh more slowly. A production key is recommended for larger deployments.

For provider failures, inspect logs, admin health and [Diagnostics CLI](diagnostics.md).
