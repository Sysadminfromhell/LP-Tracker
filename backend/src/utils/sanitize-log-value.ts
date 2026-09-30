/**
 * Converts externally controlled values into a representation that is safe
 * to embed in single-line application log messages.
 *
 * CR/LF and other ASCII control characters are replaced with spaces to
 * prevent log injection while keeping the original value readable.
 */
export function sanitizeLogValue(value: unknown): string {
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ');
}
export function sanitizeTableData(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeLogValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeTableData);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        sanitizeLogValue(key),
        sanitizeTableData(entry),
      ]),
    );
  }

  return value;
}