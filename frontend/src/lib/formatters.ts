import { formatSlotRangeInMsk, formatAdminBookingTime } from '@/api/time';

export { formatSlotRangeInMsk, formatAdminBookingTime };

export function formatDateInMsk(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTimeInMsk(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
