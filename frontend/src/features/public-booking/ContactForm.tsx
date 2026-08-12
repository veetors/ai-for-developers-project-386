import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateBooking } from '@/features/public-booking/useCreateBooking';
import { toFieldErrors } from '@/api/errors';
import type { EventType, Slot } from '@/api/types';

const schema = z.object({
  guest_name: z
    .string()
    .trim()
    .min(1, 'Укажите имя.')
    .max(200, 'Не более 200 символов.'),
  guest_email: z.string().trim().email('Введите корректный e-mail.'),
});

export type ContactFormValues = z.infer<typeof schema>;

interface ContactFormProps {
  eventType: EventType;
  slot: Slot;
  date: string;
}

export function ContactForm({ eventType, slot, date }: ContactFormProps) {
  const mutation = useCreateBooking();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { guest_name: '', guest_email: '' },
  });

  const onSubmit: SubmitHandler<ContactFormValues> = (values) => {
    mutation.mutate(
      {
        eventTypeId: eventType.id,
        date,
        request: {
          guest_name: values.guest_name,
          guest_email: values.guest_email,
          start_at: slot.start_at,
        },
      },
      {
        onError(error) {
          const fieldErrors = error instanceof Error ? toFieldErrors(error as never) : {};
          for (const [field, messages] of Object.entries(fieldErrors)) {
            const message = messages[0];
            if (!message) continue;
            if (field === 'guest_name' || field === 'guest_email') {
              setError(field, { message });
            }
          }
        },
        onSuccess() {
          window.location.assign(`/event-types/${eventType.id}/success`);
        },
      },
    );
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="guest_name">Имя</Label>
        <Input id="guest_name" autoComplete="name" {...register('guest_name')} />
        {errors.guest_name && (
          <p className="text-sm text-destructive">{errors.guest_name.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guest_email">E-mail</Label>
        <Input id="guest_email" type="email" autoComplete="email" {...register('guest_email')} />
        {errors.guest_email && (
          <p className="text-sm text-destructive">{errors.guest_email.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting || mutation.isPending} className="self-start">
        {mutation.isPending ? 'Отправляем…' : 'Подтвердить бронирование'}
      </Button>
    </form>
  );
}
