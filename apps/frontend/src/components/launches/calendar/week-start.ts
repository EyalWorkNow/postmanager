import i18next from 'i18next';
import type { Dayjs } from 'dayjs';

// Israeli and Arabic calendars start the week on Sunday; every other locale
// keeps the ISO week (Monday) the calendar always used.
const SUNDAY_FIRST = ['he', 'ar'];

export const isSundayFirst = () =>
  SUNDAY_FIRST.includes((i18next.resolvedLanguage || '').slice(0, 2));

/** 0-based column of `d` in a week row (0 = first day of the week). */
export const weekdayIndex = (d: Dayjs) =>
  isSundayFirst() ? d.day() : d.isoWeekday() - 1;

export const startOfWeek = (d: Dayjs) =>
  d.startOf('day').subtract(weekdayIndex(d), 'day');

export const endOfWeek = (d: Dayjs) => startOfWeek(d).add(6, 'day').endOf('day');
