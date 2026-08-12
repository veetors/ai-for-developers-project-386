import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const MSK = 'Europe/Moscow';

export function todayInMsk(): string {
  return formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd');
}

export function addDaysMsk(date: string, n: number): string {
  const zoned = toZonedTime(`${date}T00:00:00`, MSK);
  const shifted = new Date(zoned.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + n);
  return format(shifted, 'yyyy-MM-dd');
}

export function isWithinBookingWindow(date: string): boolean {
  const from = todayInMsk();
  const to = addDaysMsk(from, 13);
  return date >= from && date <= to;
}

export function formatSlotRangeInMsk(startIso: string, endIso: string): string {
  const start = formatInTimeZone(startIso, MSK, 'HH:mm');
  const end = formatInTimeZone(endIso, MSK, 'HH:mm');
  return `${start} — ${end}`;
}

export function formatAdminBookingTime(iso: string): string {
  return formatInTimeZone(iso, MSK, "d MMMM yyyy 'г.,' HH:mm");
}

export function formatIsoDateInMsk(iso: string): string {
  return formatInTimeZone(iso, MSK, 'yyyy-MM-dd');
}

export function formatHumanDateInMsk(iso: string): string {
  return formatInTimeZone(iso, MSK, 'd MMMM yyyy');
}
