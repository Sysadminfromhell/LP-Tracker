import { describe, expect, it } from 'vitest';
import { sanitizeLogValue } from '../src/utils/sanitize-log-value';

describe('sanitizeLogValue', () => {
  it('keeps normal log values unchanged', () => {
    expect(sanitizeLogValue('FourK#EUW')).toBe('FourK#EUW');
  });
  it('replaces CR and LF characters', () => {
    expect(sanitizeLogValue('FourK\r\n[ADMIN] injected')).toBe('FourK  [ADMIN] injected');
  });
  it('replaces other ASCII control characters', () => {
    expect(sanitizeLogValue('foo\tbar\u0000baz\u007f')).toBe('foo bar baz ');
  });
  it('converts non-string values to strings', () => {
    expect(sanitizeLogValue(123)).toBe('123');
    expect(sanitizeLogValue(null)).toBe('null');
  });
});
