# ROADMAP

This file describes the next Roadmap milestones and feature sets currently planned.

| Version  | New Feature / Changes | Done |
| --- | --- | --- |
| ~~v2.0.1~~ | ~~Remove legacy LP history resolution path~~  | Yes (08/25/2026) |
| ~~v2.0.2~~ | ~~Add runtime API validation and shared contracts~~ | Yes (09/18/2026) |
| ~~v2.1.0~~ | ~~Introduce frontend routing~~ | Yes (09/18/2026) |
| ~~v2.2.0~~ | ~~Replace polling with SSE~~ | Yes (09/21/2026) |
| ~~v2.3.0~~ | ~~Add stable player/event overlay routes~~ | Yes (09/21/2026) |
| ~~v2.4.0~~ | ~~Add event history and player detail views~~ | Yes (09/21/2026) |
| ~~v2.4.1~~ | ~~Add CLI/Diagnostic Tools~~ | Yes (09/22/2026) |
| ~~v2.4.2~~ | ~~Add "Dangerzone" in Admin Page for advanced Database manipulation and pruning~~ | Yes (09/23/2026) |
| ~~v2.5.0~~ | ~~Add serveral Privacy Policy Pages and subpages to comply with German/EU Data protection rights~~ | Yes (09/24/2026) |
| ~~v2.5.2~~ | ~~Minor bugfixes; Handling Remakes and LP Loss protected matches~~ | Yes (09/28/2026) |
| v2.5.5 | Backend cleanup: remove legacy `src/db/leaderboard.ts` after verifying all runtime, test, CLI and CI references | No |
|  | Remove obsolete `src/db/test*.ts` utility/test files after verifying they are no longer used | No |
|  | Move workflow/business logic from `src/db/event-refresh.ts` into the service layer and keep DB modules persistence-focused | No |
|  | Split `src/db/lp-reconciliation.ts` into smaller, clearly scoped persistence modules | No |
|  | Replace reconciliation retry/error string matching with typed reason codes/constants | No |
|  | Reduce business logic inside `admin-player.routes.ts`, `admin-event.routes.ts` and `admin-database.routes.ts` | No |
|  | Establish a consistent backend dependency flow: `routes -> services -> db/providers` | No |
|  | Standardize logging callers and replace mutable `let caller = ...` patterns with a consistent logger/context approach | No |
|  | Rename Riot rate-limit modules to clearly distinguish parsing from throttling responsibilities | No |
|  | Consolidate duplicated DB/domain/API type definitions and establish a consistent `DB Row -> Domain Model -> API Contract` mapping | No |
|  | Review remaining backend modules for legacy V1/V2 architecture patterns and align them with the current structure and conventions | No |
|  | Run backend tests, typecheck, build and diagnostics after every cleanup group to prevent regressions | No |
| v2.6.0 | Extend Prometheus metrics and performance monitoring | No |