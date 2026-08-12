import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { AppError, errorMessageFor } from '@/api/errors';
import { adminEventTypesQueryKey } from './useAdminEventTypes';
import { adminEventTypeQueryKey } from './useAdminEventType';
import type { EventType, EventTypeInput } from '@/api/types';

interface UpdateArgs {
  id: number;
  input: EventTypeInput;
}

async function putEventType({ id, input }: UpdateArgs): Promise<EventType> {
  const { data } = await api.PUT('/api/owner/event-types/{id}', {
    params: { path: { id } },
    body: input,
  });
  return data as EventType;
}

export function useUpdateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putEventType,
    onSuccess(_updated, vars) {
      void queryClient.invalidateQueries({ queryKey: adminEventTypesQueryKey });
      void queryClient.invalidateQueries({ queryKey: adminEventTypeQueryKey(vars.id) });
    },
    onError(error) {
      toast.error(error instanceof AppError ? errorMessageFor(error.body) : 'Не удалось обновить тип события.');
    },
  });
}
