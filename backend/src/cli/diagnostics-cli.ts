import type { DiagnosticCheck, DiagnosticReport } from '../diagnostics/types';
import { log, logTable } from '../utils/logging';

let caller = 'DIAG';
let databaseLoaded = false;


function printHelp(): void {
  log(caller, 'info', `LP Tracker Diagnostics`);
  log(caller, 'info', `Usage:`);
  log(caller, 'info', `diagnose <command> [options]`);
  log(caller, 'info', ``);
  log(caller, 'info', `Commands:`);
  log(caller, 'info', `  summary             Run top-level diagnostics`);
  log(caller, 'info', `  db                  Check database and migrations`);
  log(caller, 'info', `  event               Check event integrity`);
  log(caller, 'info', `  player <id>         Inspect one player`);
  log(caller, 'info', `  player --id <id>    Inspect one player`);
  log(caller, 'info', `  queue               Inspect LP reconciliation queue`);
  log(caller, 'info', `  provider            Check league data provider`);
  log(caller, 'info', ``);
  log(caller, 'info', `Options:`);
  log(caller, 'info', `  --json      Output machine-readable JSON`);
  log(caller, 'info', `  --help      Show this help`);
}

function printCheck(check: DiagnosticCheck): void {
  const label = check.status === 'error' ? 'FAIL' : check.status === 'warning' ? 'WARN' : 'OK';
  log(caller, 'info', `[${label}] ${check.code}: ${check.message}`);
  if (check.details === undefined) {
    return;
  }
  if (Array.isArray(check.details)) {
    if (check.details.length > 0) {
      logTable(caller,'info',check.details);
    }
    return;
  }
  logTable(caller,'info',[check.details])
}

function printReport(report: DiagnosticReport): void {
  log(caller, 'info', '');
  log(caller, 'info', `LP Tracker Diagnostics · ${report.scope}`);
  log(caller, 'info', '================================');
  log(caller, 'info', '');
  for (const check of report.checks) {
    printCheck(check);
  }
  log(caller, 'info', '');
  if (report.status === 'error') {
    log(caller, 'error', 'Diagnostics completed with errors');
    return;
  }
  if (report.status === 'warning') {
    log(caller, 'warn', 'Diagnostics completed with errors');
    return;
  }
  log(caller, 'info', 'Diagnostics completed successfully');
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
        log(caller, 'error', 'Player diagnostics require a valid player id');
        log(caller, 'error', '');
        log(caller, 'error', 'Usage:');
        log(caller, 'error', '  diagnose player <id>');
        log(caller, 'error', '  diagnose player --id <id>');
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
      log(caller, 'error', `Unknown diagnostic command: ${command}`);
      log(caller, 'error', '');
      printHelp();
      process.exitCode = 2;
      return;
  }
  if (json) {
    log(caller,'info',JSON.stringify(report, null, 2));
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
    log(caller, 'error', `Command failed:`);
    log(caller, 'error', error);
    process.exitCode = 2;
  })
  .finally(async () => {
    if (!databaseLoaded) {
      return;
    }
    const { closeDatabase } = await import('../db/client.js');
    await closeDatabase().catch(() => {});
  });
