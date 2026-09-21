import type { DiagnosticCheck, DiagnosticReport } from '../diagnostics/types';

let databaseLoaded = false;

function printHelp(): void {
  console.log(`
LP Tracker Diagnostics

Usage:
  diagnose <command> [options]

Commands:
  summary             Run top-level diagnostics
  db                  Check database and migrations
  event               Check event integrity
  player <id>         Inspect one player
  player --id <id>    Inspect one player
  queue               Inspect LP reconciliation queue
  provider            Check league data provider

Options:
  --json      Output machine-readable JSON
  --help      Show this help
`);
}

function printCheck(check: DiagnosticCheck): void {
  const label = check.status === 'error' ? 'FAIL' : check.status === 'warning' ? 'WARN' : 'OK';
  console.log(`[${label}] ${check.code}: ${check.message}`);
  if (check.details === undefined) {
    return;
  }
  if (Array.isArray(check.details)) {
    if (check.details.length > 0) {
      console.table(check.details);
    }
    return;
  }
  console.table([check.details]);
}

function printReport(report: DiagnosticReport): void {
  console.log();
  console.log(`LP Tracker Diagnostics · ${report.scope}`);
  console.log('================================');
  console.log();
  for (const check of report.checks) {
    printCheck(check);
  }
  console.log();
  if (report.status === 'error') {
    console.error('[FAIL] Diagnostics completed with errors');
    return;
  }
  if (report.status === 'warning') {
    console.warn('[WARN] Diagnostics completed with warnings');
    return;
  }
  console.log('[OK] Diagnostics completed successfully');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const help = args.includes('--help');
  const command = args.find((arg) => !arg.startsWith('--'));
  if (help || !command) {
    printHelp();
    return;
  }
  let report: DiagnosticReport;
  switch (command) {
    case 'summary': {
      databaseLoaded = true;
      const { runSummaryDiagnostics } = await import('../diagnostics/summary.js');
      report = await runSummaryDiagnostics();
      break;
    }
    case 'db': {
      databaseLoaded = true;
      const { runDatabaseDiagnostics } = await import('../diagnostics/database.js');
      report = await runDatabaseDiagnostics();
      break;
    }
    case 'event': {
      databaseLoaded = true;
      const { runEventDiagnostics } = await import('../diagnostics/event.js');
      report = await runEventDiagnostics();
      break;
    }
    case 'player': {
      const playerId = getPlayerId(args);
      if (playerId === null) {
        console.error('Player diagnostics require a valid player id');
        console.error();
        console.error('Usage:');
        console.error('  diagnose player <id>');
        console.error('  diagnose player --id <id>');
        process.exitCode = 2;
        return;
      }
      databaseLoaded = true;
      const { runPlayerDiagnostics } = await import('../diagnostics/player.js');
      report = await runPlayerDiagnostics(playerId);
      break;
    }
    case 'queue': {
      databaseLoaded = true;
      const { runQueueDiagnostics } = await import('../diagnostics/queue.js');
      report = await runQueueDiagnostics();
      break;
    }
    case 'provider': {
      const { runProviderDiagnostics } = await import('../diagnostics/provider.js');
      report = await runProviderDiagnostics();
      break;
    }
    default:
      console.error(`Unknown diagnostic command: ${command}`);
      console.error();
      printHelp();
      process.exitCode = 2;
      return;
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  if (report.status === 'error') {
    process.exitCode = 1;
  }
}
function getPlayerId(args: string[]): number | null {
  const commandIndex = args.indexOf('player');
  if (commandIndex === -1) {
    return null;
  }
  const idOptionIndex = args.indexOf('--id');
  const rawId =
    idOptionIndex !== -1
      ? args[idOptionIndex + 1]
      : args[commandIndex + 1]?.startsWith('--')
        ? undefined
        : args[commandIndex + 1];
  if (!rawId) {
    return null;
  }
  const playerId = Number(rawId);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) {
    return null;
  }
  return playerId;
}
main()
  .catch((error) => {
    console.error('[DIAGNOSTICS] Command failed:');
    console.error(error);
    process.exitCode = 2;
  })
  .finally(async () => {
    if (!databaseLoaded) {
      return;
    }
    const { closeDatabase } = await import('../db/client.js');
    await closeDatabase().catch(() => {});
  });
