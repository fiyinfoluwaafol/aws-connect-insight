const EXPLICIT_TZ = /[zZ]$|[+-]\d{2}:\d{2}(:\d{2})?$/;

/**
 * Parse timestamps from the API/Postgres for display and sorting.
 * Datetimes without a timezone suffix are treated as UTC so `toLocaleString()` matches wall-clock intent
 * (naive server timestamps were typically UTC; without "Z", JS would interpret them as local).
 */
export function parseBackendTimestamp(value: string | null | undefined): Date {
  if (value == null || value.trim() === '') {
    return new Date();
  }
  const s = value.trim();
  if (EXPLICIT_TZ.test(s)) {
    return new Date(s);
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(`${s}Z`);
  }
  return new Date(s);
}
