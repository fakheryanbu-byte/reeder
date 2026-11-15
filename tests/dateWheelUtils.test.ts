import { describe, expect, it } from 'vitest';
import {
  clampDatePartsToRange,
  convertDateBetweenCalendars,
  formatDateParts,
  getCurrentGregorianDate,
  getCurrentHijriDate,
  getDaysInMonth,
  getGregorianDaysInMonth,
  getHijriDaysInMonth,
  getYearRange,
  parseDateStringToParts,
} from '../src/utils/dateWheelUtils';

describe('Date wheel picker calendar and range utilities', () => {
  it('computes dynamic Gregorian and Hijri year ranges from (current - 100) to (current + 50)', () => {
    const gCurrent = getCurrentGregorianDate().year;
    const gYears = getYearRange(gCurrent);
    expect(gYears[0]).toBe(gCurrent - 100);
    expect(gYears[gYears.length - 1]).toBe(gCurrent + 50);
    expect(gYears).toHaveLength(151);

    const hCurrent = getCurrentHijriDate().year;
    const hYears = getYearRange(hCurrent);
    expect(hYears[0]).toBe(hCurrent - 100);
    expect(hYears[hYears.length - 1]).toBe(hCurrent + 50);
    expect(hYears).toHaveLength(151);
  });

  it('computes dynamic Gregorian days in month (28-31 including leap years)', () => {
    expect(getGregorianDaysInMonth(2024, 2)).toBe(29); // leap year
    expect(getGregorianDaysInMonth(2025, 2)).toBe(28); // non-leap year
    expect(getGregorianDaysInMonth(2000, 2)).toBe(29); // century leap year
    expect(getGregorianDaysInMonth(1900, 2)).toBe(28); // non-leap century year
    expect(getGregorianDaysInMonth(2026, 4)).toBe(30);
    expect(getGregorianDaysInMonth(2026, 7)).toBe(31);
  });

  it('computes dynamic Hijri days in month (29 or 30)', () => {
    for (let month = 1; month <= 12; month++) {
      const days = getHijriDaysInMonth(1448, month);
      expect(days === 29 || days === 30).toBe(true);
    }
    expect(getDaysInMonth('hijri', 1448, 1)).toBeGreaterThanOrEqual(29);
    expect(getDaysInMonth('hijri', 1448, 1)).toBeLessThanOrEqual(30);
  });

  it('clamps out-of-range days and years when switching month, year, or calendar', () => {
    const febNonLeap = clampDatePartsToRange(
      { year: 2025, month: 2, day: 31 },
      'gregorian',
      new Date(Date.UTC(2026, 10, 14))
    );
    expect(febNonLeap).toEqual({ year: 2025, month: 2, day: 28 });

    const hijriClamped = clampDatePartsToRange(
      { year: 1447, month: 1, day: 31 },
      'hijri',
      new Date(Date.UTC(2026, 10, 14))
    );
    expect(hijriClamped.day).toBeLessThanOrEqual(30);
    expect(hijriClamped.day).toBeGreaterThanOrEqual(29);
  });

  it('converts between Gregorian and Hijri calendars and parses/formats cleanly', () => {
    const hijri = convertDateBetweenCalendars(
      { year: 2026, month: 11, day: 14 },
      'gregorian',
      'hijri'
    );
    expect(hijri.year).toBeGreaterThanOrEqual(1447);
    expect(hijri.year).toBeLessThanOrEqual(1449);

    const roundTrip = convertDateBetweenCalendars(hijri, 'hijri', 'gregorian');
    expect(roundTrip).toEqual({ year: 2026, month: 11, day: 14 });

    expect(formatDateParts({ year: 1413, month: 2, day: 16 }, 'hijri')).toBe('1413/02/16');
    expect(formatDateParts({ year: 1992, month: 8, day: 5 }, 'gregorian')).toBe('1992-08-05');

    expect(parseDateStringToParts('١٤١٣/٠٢/١٦', 'unknown')).toEqual({
      calendar: 'hijri',
      parts: { year: 1413, month: 2, day: 16 },
    });
    expect(parseDateStringToParts('1992-08-15', 'unknown')).toEqual({
      calendar: 'gregorian',
      parts: { year: 1992, month: 8, day: 15 },
    });
  });
});
