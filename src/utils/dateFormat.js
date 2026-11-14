// ============================================================================
// DATE / TIME HELPERS
// All kick-off times are displayed in the tournament timezone
// (Africa/Algiers by default, taken from tournament_settings).
// ============================================================================

/**
 * Offset (ms) of a timezone at a given UTC timestamp.
 * Uses Intl to compute the wall clock in that zone.
 */
function tzOffsetMs(utcMs, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convert a datetime-local form value ("2026-03-14T16:00"), interpreted as
 * wall-clock time in the tournament timezone, into a real UTC ISO string.
 */
export function wallTimeToIso(wall, timeZone) {
  if (!wall) return null;
  const guess = Date.parse(`${wall.slice(0, 16)}:00Z`.slice(0, 25));
  if (Number.isNaN(guess)) return null;
  // Two passes handle DST shifts safely.
  let ts = guess - tzOffsetMs(guess, timeZone);
  ts = guess - tzOffsetMs(ts, timeZone);
  return new Date(ts).toISOString();
}

/** Convert an ISO timestamp into a datetime-local value in the given zone. */
export function isoToWallInput(iso, timeZone) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "Sat 21 Nov 2026 · 15:30" in the current locale + tournament timezone. */
export function formatKickoff(iso, locale, timeZone) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Long date for section headers: "21 November 2026". */
export function formatDateLong(iso, locale, timeZone) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Time only: "15:30". */
export function formatTime(iso, locale, timeZone) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Compact date + time for audit tables: "21/11/2026 15:30". */
export function formatDateTime(iso, locale, timeZone) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Wall-clock date ("2026-03-14") of a Date or timestamp in the given zone. */
function dayKey(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isoToWallInput(date.toISOString(), timeZone).slice(0, 10);
}

/**
 * Return { labelKey, time } when the match is today or tomorrow
 * (labels: match.today / match.tomorrow), otherwise { labelKey: null }.
 */
export function relativeDay(iso, locale, timeZone) {
  if (!iso) return { labelKey: null, time: null };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { labelKey: null, time: null };

  const today = dayKey(new Date(), timeZone);
  const tomorrow = dayKey(new Date(Date.now() + 86400000), timeZone);
  const target = dayKey(date, timeZone);

  if (target === today) return { labelKey: 'match.today', time: formatTime(iso, locale, timeZone) };
  if (target === tomorrow) return { labelKey: 'match.tomorrow', time: formatTime(iso, locale, timeZone) };
  return { labelKey: null, time: null };
}
