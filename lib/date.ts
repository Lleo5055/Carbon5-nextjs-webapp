// lib/date.ts

/**
 * Converts raw month values (ISO dates or strings like "2025-11-01")
 * into UK format e.g. "November 2025".
 *
 * ALWAYS returns a user-friendly UK month label.
 * Never returns ISO or machine dates.
 */
export function formatMonthLabel(raw: string | null): string {
  if (!raw) return '—';

  // Already formatted like "November 2025"
  if (isNaN(Date.parse(raw)) === true && raw.includes(' ')) {
    return raw;
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  return raw;
}
