import { describe, expect, it, afterEach } from 'vitest';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import i18next from 'i18next';
import { startOfWeek, endOfWeek, weekdayIndex } from './week-start';

dayjs.extend(isoWeek);
const setLang = (lng: string) =>
  Object.defineProperty(i18next, 'resolvedLanguage', { value: lng, configurable: true });

describe('week start', () => {
  afterEach(() => setLang('en'));
  const thursday = dayjs('2026-10-08T15:00:00');

  it('starts on Sunday in Hebrew', () => {
    setLang('he');
    expect(startOfWeek(thursday).format('YYYY-MM-DD dddd')).toBe('2026-10-04 Sunday');
    expect(endOfWeek(thursday).format('YYYY-MM-DD')).toBe('2026-10-10');
    expect(weekdayIndex(dayjs('2026-10-04'))).toBe(0);
  });

  it('keeps the ISO week (Monday) elsewhere', () => {
    setLang('en');
    expect(startOfWeek(thursday).format('YYYY-MM-DD dddd')).toBe('2026-10-05 Monday');
    expect(weekdayIndex(dayjs('2026-10-04'))).toBe(6);
  });
});
