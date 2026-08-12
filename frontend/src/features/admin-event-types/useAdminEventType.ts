import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { EventType } from '@/api/types';

export function adminEventTypeQueryKey(id: number) {
  return ['admin', 'event-type', id] as const;
}

async function fetchAdminEventType(id: number): Promise<EventType> {
  const { data } = await api.GET('/api/owner/event-types/{id}', {
    params: { path: { id } },
  });
  return data as EventType;
}

export function useAdminEventType(id: number) {
  return useQuery({
    queryKey: adminEventTypeQueryKey(id),
    queryFn: () => fetchAdminEventType(id),
    enabled: Number.isFinite(id),
  });
}
