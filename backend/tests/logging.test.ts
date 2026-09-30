import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log, logTable } from '../src/utils/logging';

describe('logging', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'table').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });
  it('defaults to info', () => {
    delete process.env.LOG_LEVEL;
    log('TEST', 'dbg', 'debug');
    log('TEST', 'info', 'info');
    log('TEST', 'warn', 'warn');
    log('TEST', 'error', 'error');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
  it('logs all levels when LOG_LEVEL is dbg', () => {
    process.env.LOG_LEVEL = 'dbg';
    log('TEST', 'dbg', 'debug');
    log('TEST', 'info', 'info');
    log('TEST', 'warn', 'warn');
    log('TEST', 'error', 'error');
    expect(console.debug).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
  it('only logs warn and error when LOG_LEVEL is warn', () => {
    process.env.LOG_LEVEL = 'warn';
    log('TEST', 'dbg', 'debug');
    log('TEST', 'info', 'info');
    log('TEST', 'warn', 'warn');
    log('TEST', 'error', 'error');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
  it('only logs error when LOG_LEVEL is error', () => {
    process.env.LOG_LEVEL = 'error';
    log('TEST', 'dbg', 'debug');
    log('TEST', 'info', 'info');
    log('TEST', 'warn', 'warn');
    log('TEST', 'error', 'error');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });
  it('sanitizes externally controlled log values', () => {
    process.env.LOG_LEVEL = 'info';
    log('TEST\nFAKE', 'info', 'hello\r\n[ERROR] injected', 'SUB\tPROCESS', 'foo\u0000bar');
    expect(console.info).toHaveBeenCalledTimes(1);
    const output = vi.mocked(console.info).mock.calls[0][0];
    expect(output).not.toContain('\n');
    expect(output).not.toContain('\r');
    expect(output).not.toContain('\t');
    expect(output).not.toContain('\u0000');
    expect(output).toContain('TEST FAKE');
    expect(output).toContain('hello  [ERROR] injected');
  });

  it('does not output a table below the configured log level', () => {
    process.env.LOG_LEVEL = 'info';
    logTable('TEST', 'dbg', [{ value: 'test' }]);
    expect(console.table).not.toHaveBeenCalled();
  });
  it('sanitizes table data', () => {
    process.env.LOG_LEVEL = 'dbg';
    logTable('TEST', 'dbg', [
      {
        name: 'FourK\n[ERROR] injected',
      },
    ]);
    expect(console.table).toHaveBeenCalledWith([
      {
        name: 'FourK [ERROR] injected',
      },
    ]);
  });
});
