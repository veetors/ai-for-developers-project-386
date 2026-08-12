import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateEventType } from './useCreateEventType';
import { useUpdateEventType } from './useUpdateEventType';
import type { EventType } from '@/api/types';

const FIXED_DURATION = 30;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Укажите название.')
    .max(200, 'Не более 200 символов.'),
  description: z.string().trim().max(2000, 'Слишком длинное описание.'),
});

export type EventTypeFormValues = z.infer<typeof schema>;

interface EventTypeFormProps {
  initial?: Pick<EventType, 'name' | 'description'>;
  mode: 'create' | 'edit';
  eventTypeId?: number;
  onSuccess?: () => void;
}

export function EventTypeForm({ initial, mode, eventTypeId, onSuccess }: EventTypeFormProps) {
  const create = useCreateEventType();
  const update = useUpdateEventType();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventTypeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
    },
  });

  useEffect(() => {
    if (initial) {
      reset({ name: initial.name, description: initial.description });
    }
  }, [initial, reset]);

  const submit: SubmitHandler<EventTypeFormValues> = (values) => {
    if (mode === 'create') {
      create.mutate(
        { ...values, duration_minutes: FIXED_DURATION },
        {
          onSuccess: () => onSuccess?.(),
        },
      );
      return;
    }
    if (mode === 'edit' && typeof eventTypeId === 'number') {
      update.mutate(
        {
          id: eventTypeId,
          input: { ...values, duration_minutes: FIXED_DURATION },
        },
        {
          onSuccess: () => onSuccess?.(),
        },
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex max-w-xl flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Название</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Описание</Label>
        <Input id="description" {...register('description')} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="duration_minutes">Длительность, мин</Label>
        <Input
          id="duration_minutes"
          type="number"
          value={FIXED_DURATION}
          readOnly
          disabled
          aria-describedby="duration-help"
        />
        <p id="duration-help" className="text-xs text-muted-foreground">
          В v1 длительность фиксирована — 30 минут.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            create.isPending ||
            update.isPending ||
            (mode === 'edit' && !isDirty)
          }
        >
          {create.isPending || update.isPending ? 'Сохраняем…' : mode === 'create' ? 'Создать' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
