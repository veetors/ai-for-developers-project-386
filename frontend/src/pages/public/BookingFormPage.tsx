import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { api } from '@/api/client';
import { todayInMsk } from '@/api/time';
import { formatSlotRangeInMsk, formatDateInMsk } from '@/lib/formatters';
import { useBookingDraft } from '@/features/public-booking/BookingDraftContext';
import { ContactForm } from '@/features/public-booking/ContactForm';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { EventType } from '@/api/types';

const MSK = 'Europe/Moscow';

async function fetchEventType(id: number): Promise<EventType> {
  const { data } = await api.GET('/api/event-types/{id}', { params: { path: { id } } });
  return data as EventType;
}

export function BookingFormPage() {
  const params = useParams<{ id: string }>();
  const draft = useBookingDraft();
  const eventTypeId = Number(params.id);
  const isValidId = Number.isInteger(eventTypeId) && eventTypeId > 0;

  const eventTypeQuery = useQuery({
    queryKey: ['public', 'event-type', eventTypeId],
    queryFn: () => fetchEventType(eventTypeId),
    enabled: isValidId && draft.eventTypeId === eventTypeId,
  });

  if (!isValidId || !draft.slot || draft.eventTypeId !== eventTypeId) {
    return <Navigate to={`/event-types/${eventTypeId}`} replace />;
  }

  const date = draft.date ?? todayInMsk();

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Подтверждение бронирования</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {eventTypeQuery.data?.name ?? 'Тип события'}
          </CardTitle>
          <CardDescription>{eventTypeQuery.data?.description ?? ''}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">Дата</p>
            <p className="text-sm font-medium">
              {formatDateInMsk(`${date}T12:00:00+03:00`)}
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">Время (МСК)</p>
            <p className="text-sm font-medium">
              {formatSlotRangeInMsk(draft.slot.start_at, draft.slot.end_at)}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(toZonedTime(draft.slot.start_at, MSK), 'HH:mm')} МСК
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {eventTypeQuery.isPending && <LoadingSpinner label="Готовим форму…" />}
      {eventTypeQuery.isError && <ErrorMessage message="Не удалось загрузить тип события." />}

      {eventTypeQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Контактные данные</CardTitle>
            <CardDescription>
              <Badge variant="outline">{eventTypeQuery.data.duration_minutes} мин</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm eventType={eventTypeQuery.data} slot={draft.slot} date={date} />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost">
          <Link to={`/event-types/${eventTypeId}`}>Назад</Link>
        </Button>
      </div>
    </section>
  );
}
