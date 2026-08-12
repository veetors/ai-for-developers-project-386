import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { EventType } from '@/api/types';

export const publicEventTypesQueryKey = ['public', 'event-types'] as const;

async function fetchEventTypes(): Promise<EventType[]> {
  const { data } = await api.GET('/api/event-types');
  return (data ?? []) as EventType[];
}

export function useEventTypes() {
  return useQuery({
    queryKey: publicEventTypesQueryKey,
    queryFn: fetchEventTypes,
  });
}
