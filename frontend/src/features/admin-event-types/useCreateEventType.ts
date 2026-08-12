import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { AppError, errorMessageFor } from '@/api/errors';
import { adminEventTypesQueryKey } from './useAdminEventTypes';
import { adminEventTypeQueryKey } from './useAdminEventType';
import type { EventType, EventTypeInput } from '@/api/types';

async function postEventType(input: EventTypeInput): Promise<EventType> {
  const { data } = await api.POST('/api/owner/event-types', { body: input });
  return data as EventType;
}

export function useCreateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postEventType,
    onSuccess(created) {
      void queryClient.invalidateQueries({ queryKey: adminEventTypesQueryKey });
      void queryClient.invalidateQueries({ queryKey: adminEventTypeQueryKey(created.id) });
    },
    onError(error) {
      toast.error(error instanceof AppError ? errorMessageFor(error.body) : 'Не удалось создать тип события.');
    },
  });
}
