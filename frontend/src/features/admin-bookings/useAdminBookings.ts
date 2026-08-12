import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AdminBooking } from '@/api/types';

export const adminBookingsQueryKey = ['admin', 'bookings'] as const;

async function fetchAdminBookings(): Promise<AdminBooking[]> {
  const { data } = await api.GET('/api/owner/bookings');
  return (data ?? []) as AdminBooking[];
}

export function useAdminBookings() {
  return useQuery({
    queryKey: adminBookingsQueryKey,
    queryFn: fetchAdminBookings,
  });
}
