import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { EventType } from '@/api/types';

export const adminEventTypesQueryKey = ['admin', 'event-types'] as const;

async function fetchAdminEventTypes(): Promise<EventType[]> {
  const { data } = await api.GET('/api/owner/event-types');
  return (data ?? []) as EventType[];
}

export function useAdminEventTypes() {
  return useQuery({
    queryKey: adminEventTypesQueryKey,
    queryFn: fetchAdminEventTypes,
  });
}
