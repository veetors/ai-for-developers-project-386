import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { AppError, errorMessageFor } from '@/api/errors';
import { slotsQueryKey } from '@/features/public-slot-picker/useSlots';
import type { BookingConfirmation, BookingRequest } from '@/api/types';

export const BOOKING_LAST_KEY = 'booking:last';

async function createBooking(eventTypeId: number, request: BookingRequest): Promise<BookingConfirmation> {
  const { data } = await api.POST('/api/event-types/{id}/bookings', {
    params: { path: { id: eventTypeId } },
    body: request,
  });
  return data as BookingConfirmation;
}

export interface CreateBookingArgs {
  eventTypeId: number;
  request: BookingRequest;
  date: string;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventTypeId, request }: CreateBookingArgs) =>
      createBooking(eventTypeId, request),
    onSuccess: async (confirmation, vars) => {
      try {
        sessionStorage.setItem(BOOKING_LAST_KEY, JSON.stringify(confirmation));
      } catch {
        // ignore quota errors
      }
      await queryClient.invalidateQueries({
        queryKey: slotsQueryKey(vars.eventTypeId, vars.date),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
    onError: (error, vars) => {
      if (error instanceof AppError) {
        if (error.status === 409 && error.body.code === 'slot_taken') {
          toast.error(errorMessageFor(error.body));
          void queryClient.invalidateQueries({
            queryKey: slotsQueryKey(vars.eventTypeId, vars.date),
          });
          return;
        }
        if (error.status === 422 || error.status === 404) {
          toast.error(errorMessageFor(error.body));
          return;
        }
      }
      toast.error('Не удалось создать бронирование.');
    },
  });
}
