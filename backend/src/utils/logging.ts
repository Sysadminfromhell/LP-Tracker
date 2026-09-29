import { sanitizeLogValue, sanitizeTableData } from './sanitize-log-value';

export type LogLevel = 'dbg' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  dbg: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LOG_LEVEL: LogLevel = 'info';

function getConfiguredLogLevel(): LogLevel {
  const configuredLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (
    configuredLevel === 'dbg' ||
    configuredLevel === 'info' ||
    configuredLevel === 'warn' ||
    configuredLevel === 'error'
  ) {
    return configuredLevel;
  }
  return DEFAULT_LOG_LEVEL;
}

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = getConfiguredLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

export function log(
  caller: string,
  level: LogLevel,
  message: string,
  subprocess?: string,
  opts?: string,
): void {
  if (!shouldLog(level)) {
    return;
  }
  const timestamp = new Date().toISOString();
  const safeCaller = sanitizeLogValue(caller);
  const safeSubprocess = subprocess !== undefined ? sanitizeLogValue(subprocess) : null;
  const safeMessage = sanitizeLogValue(message);
  const safeOpts = opts !== undefined ? sanitizeLogValue(opts) : null;
  const fullMessage =
    `[${timestamp}] ${level.toUpperCase()} ${safeCaller}` +
    (safeSubprocess !== null ? `-${safeSubprocess}` : ``) +
    ` ${safeMessage}` +
    (safeOpts !== null ? ` ${safeOpts}` : '');
  switch (level) {
    case 'dbg':
      console.debug(fullMessage);
      break;
    case 'info':
      console.info(fullMessage);
      break;
    case 'warn':
      console.warn(fullMessage);
      break;
    case 'error':
      console.error(fullMessage);
      break;
  }
}
export function logTable(
  caller: string,
  level: LogLevel,
  data: unknown,
  subprocess?: string,
  opts?: string,
): void {
  if (!shouldLog(level)) {
    return;
  }
  log(caller, level, 'Table output:', subprocess, opts);
  console.table(sanitizeTableData(data));
}
