import type { CalendarType } from '../types/guest';
import { toAsciiDigits } from './documentRules';

export type ActiveCalendar = 'gregorian' | 'hijri';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const hijriMonthDaysCache = new Map<string, 29 | 30>();

const hijriFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return null;
  }
})();

function formatUtcDateToHijriParts(utcDate: Date): DateParts | null {
  if (!hijriFormatter) return null;
  try {
    const parts = hijriFormatter.formatToParts(utcDate);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) && y > 0 && m >= 1 && m <= 12) {
      return { year: y, month: m, day: d };
    }
  } catch {
    // Fallback below
  }
  return null;
}

function approxHijriToUtc(hy: number, hm: number, hd: number): Date {
  const jd =
    Math.floor((11 * hy + 3) / 30) +
    354 * hy +
    30 * hm -
    Math.floor((hm - 1) / 2) +
    hd +
    1948440 -
    385;
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;
  return new Date(Date.UTC(y, m - 1, d));
}

function approxGregorianToHijri(gy: number, gm: number, gd: number): DateParts {
  const utc = Date.UTC(gy, gm - 1, gd);
  const julianDay = Math.floor(utc / 86400000) + 2440588;
  let l = julianDay - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

function findUtcDateForHijri(hy: number, hm: number, hd: number): Date | null {
  if (!hijriFormatter) return null;
  const guess = approxHijriToUtc(hy, hm, hd);
  const targetOrdinal = hy * 372 + hm * 31 + hd;

  let cursor = guess.getTime();
  for (let step = 0; step < 8; step++) {
    const curParts = formatUtcDateToHijriParts(new Date(cursor));
    if (!curParts) return null;
    if (curParts.year === hy && curParts.month === hm && curParts.day === hd) {
      return new Date(cursor);
    }
    const curOrdinal = curParts.year * 372 + curParts.month * 31 + curParts.day;
    const diffDays = (hy - curParts.year) * 354 + (hm - curParts.month) * 29.5 + (hd - curParts.day);
    const delta = Math.abs(diffDays) >= 1 ? Math.round(diffDays) : targetOrdinal > curOrdinal ? 1 : -1;
    cursor += delta * 86400000;
  }

  // Fallback linear scan ±4 days around cursor
  for (let offset = -4; offset <= 4; offset++) {
    const candidate = new Date(cursor + offset * 86400000);
    const parts = formatUtcDateToHijriParts(candidate);
    if (parts && parts.year === hy && parts.month === hm && parts.day === hd) {
      return candidate;
    }
  }
  return null;
}

export function getCurrentGregorianDate(now: Date = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function getCurrentHijriDate(now: Date = new Date()): DateParts {
  const utc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const formatted = formatUtcDateToHijriParts(utc);
  if (formatted) return formatted;
  return approxGregorianToHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getYearRange(currentYear: number): number[] {
  const minYear = currentYear - 100;
  const maxYear = currentYear + 50;
  const years: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
}

export function getGregorianDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

function isTabularHijriLeapYear(year: number): boolean {
  const mod = ((year % 30) + 30) % 30;
  return [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes(mod);
}

export function getHijriDaysInMonth(year: number, month: number): 29 | 30 {
  if (month < 1 || month > 12) return 30;
  const key = `${year}-${month}`;
  const cached = hijriMonthDaysCache.get(key);
  if (cached) return cached;

  const day1 = findUtcDateForHijri(year, month, 1);
  if (day1) {
    const day30Candidate = new Date(day1.getTime() + 29 * 86400000);
    const parts30 = formatUtcDateToHijriParts(day30Candidate);
    if (parts30) {
      const length: 29 | 30 = parts30.year === year && parts30.month === month && parts30.day === 30 ? 30 : 29;
      hijriMonthDaysCache.set(key, length);
      return length;
    }
  }

  const fallback: 29 | 30 =
    month % 2 === 1 ? 30 : month === 12 && isTabularHijriLeapYear(year) ? 30 : 29;
  hijriMonthDaysCache.set(key, fallback);
  return fallback;
}

export function getDaysInMonth(
  calendar: ActiveCalendar,
  year: number,
  month: number
): number {
  return calendar === 'hijri'
    ? getHijriDaysInMonth(year, month)
    : getGregorianDaysInMonth(year, month);
}

export function convertDateBetweenCalendars(
  parts: DateParts,
  from: ActiveCalendar,
  to: ActiveCalendar
): DateParts {
  if (from === to) return parts;

  if (from === 'gregorian' && to === 'hijri') {
    const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const exact = formatUtcDateToHijriParts(utc);
    if (exact) return exact;
    return approxGregorianToHijri(parts.year, parts.month, parts.day);
  }

  // hijri -> gregorian
  const exactUtc = findUtcDateForHijri(parts.year, parts.month, parts.day);
  const resolved = exactUtc ?? approxHijriToUtc(parts.year, parts.month, parts.day);
  return {
    year: resolved.getUTCFullYear(),
    month: resolved.getUTCMonth() + 1,
    day: resolved.getUTCDate(),
  };
}

export function clampDatePartsToRange(
  parts: DateParts,
  calendar: ActiveCalendar,
  now: Date = new Date()
): DateParts {
  const currentYear =
    calendar === 'hijri' ? getCurrentHijriDate(now).year : getCurrentGregorianDate(now).year;
  const minYear = currentYear - 100;
  const maxYear = currentYear + 50;

  const year = Math.min(maxYear, Math.max(minYear, parts.year));
  const month = Math.min(12, Math.max(1, parts.month));
  const maxDays = getDaysInMonth(calendar, year, month);
  const day = Math.min(maxDays, Math.max(1, parts.day));

  return { year, month, day };
}

export function formatDateParts(parts: DateParts, calendar: ActiveCalendar): string {
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return calendar === 'hijri' ? `${y}/${m}/${d}` : `${y}-${m}-${d}`;
}

export function parseDateStringToParts(
  rawDate: string,
  calendarHint: CalendarType
): { parts: DateParts; calendar: ActiveCalendar } | null {
  const ascii = toAsciiDigits(rawDate).trim();
  if (!ascii) return null;

  const tokens = ascii.split(/[/\-.]/).filter(Boolean);
  if (tokens.length !== 3) return null;

  const n0 = Number(tokens[0]);
  const n1 = Number(tokens[1]);
  const n2 = Number(tokens[2]);
  if (!Number.isFinite(n0) || !Number.isFinite(n1) || !Number.isFinite(n2)) return null;

  let year: number;
  let month: number;
  let day: number;

  if (tokens[0].length === 4) {
    year = n0;
    month = n1;
    day = n2;
  } else if (tokens[2].length === 4) {
    day = n0;
    month = n1;
    year = n2;
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let calendar: ActiveCalendar;
  if (year >= 1300 && year <= 1550) {
    calendar = 'hijri';
  } else if (year >= 1900 && year <= 2150) {
    calendar = 'gregorian';
  } else if (calendarHint === 'hijri' || calendarHint === 'gregorian') {
    calendar = calendarHint;
  } else {
    calendar = 'gregorian';
  }

  const maxDay = getDaysInMonth(calendar, year, month);
  return {
    calendar,
    parts: {
      year,
      month,
      day: Math.min(day, maxDay),
    },
  };
}
