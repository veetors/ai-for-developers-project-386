import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { AppError, errorMessageFor } from '@/api/errors';
import { adminEventTypesQueryKey } from './useAdminEventTypes';

async function deleteEventType(id: number): Promise<void> {
  await api.DELETE('/api/owner/event-types/{id}', {
    params: { path: { id } },
  });
}

export function useDeleteEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEventType,
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: adminEventTypesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'event-type'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
    onError(error) {
      toast.error(error instanceof AppError ? errorMessageFor(error.body) : 'Не удалось удалить тип события.');
    },
  });
}
