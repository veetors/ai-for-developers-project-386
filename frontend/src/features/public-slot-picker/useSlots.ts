import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Slot } from '@/api/types';

export function slotsQueryKey(eventTypeId: number, date: string) {
  return ['public', 'slots', eventTypeId, date] as const;
}

async function fetchSlots(eventTypeId: number, date: string): Promise<Slot[]> {
  const { data } = await api.GET('/api/event-types/{id}/slots', {
    params: { path: { id: eventTypeId }, query: { date } },
  });
  return (data ?? []) as Slot[];
}

export function useSlots(eventTypeId: number, date: string | null) {
  return useQuery({
    queryKey: date ? slotsQueryKey(eventTypeId, date) : ['public', 'slots', eventTypeId, 'idle'],
    queryFn: () => fetchSlots(eventTypeId, date as string),
    enabled: typeof eventTypeId === 'number' && Number.isFinite(eventTypeId) && !!date,
  });
}
