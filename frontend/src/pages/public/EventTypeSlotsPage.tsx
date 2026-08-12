import { useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { api } from '@/api/client';
import { todayInMsk } from '@/api/time';
import { formatDateInMsk } from '@/lib/formatters';
import { useBookingDraft } from '@/features/public-booking/BookingDraftContext';
import { useSlots } from '@/features/public-slot-picker/useSlots';
import { Calendar14 } from '@/features/public-slot-picker/Calendar14';
import { SlotGrid } from '@/features/public-slot-picker/SlotGrid';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { EventType } from '@/api/types';

const MSK = 'Europe/Moscow';

async function fetchEventType(id: number): Promise<EventType> {
  const { data } = await api.GET('/api/event-types/{id}', { params: { path: { id } } });
  return data as EventType;
}

function dateToYmd(date: Date): string {
  return format(toZonedTime(date, MSK), 'yyyy-MM-dd');
}

export function EventTypeSlotsPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const draft = useBookingDraft();

  const eventTypeId = Number(params.id);
  const isValidId = Number.isInteger(eventTypeId) && eventTypeId > 0;

  const eventTypeQuery = useQuery({
    queryKey: ['public', 'event-type', eventTypeId],
    queryFn: () => fetchEventType(eventTypeId),
    enabled: isValidId,
  });

  useEffect(() => {
    if (isValidId && draft.eventTypeId !== eventTypeId) {
      draft.setEventType(eventTypeId);
    }
  }, [draft, eventTypeId, isValidId]);

  useEffect(() => {
    if (!draft.date) {
      const today = todayInMsk();
      draft.setDate(today);
    }
  }, [draft]);

  const date = draft.date ?? todayInMsk();
  const slotsQuery = useSlots(isValidId ? eventTypeId : NaN, date);

  const selectedDateValue = useMemo(() => new Date(`${date}T00:00:00`), [date]);

  if (!isValidId) {
    return <Navigate to="/event-types" replace />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {eventTypeQuery.data?.name ?? 'Тип события'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Выберите день и свободный слот в ближайшие 14 дней.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-sm font-semibold">CL</span>
              </span>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Calendar · Host</p>
                <CardTitle className="text-lg">
                  {eventTypeQuery.data?.name ?? 'Загрузка…'}
                </CardTitle>
              </div>
            </div>
            <CardDescription>
              {eventTypeQuery.data?.description ?? 'Описание появится после загрузки.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Выбранная дата</p>
              <p className="text-sm font-medium">{formatDateInMsk(`${date}T12:00:00+03:00`)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Выбранное время</p>
              <p className="text-sm font-medium">
                {draft.slot ? formatDateInMsk(draft.slot.start_at) : 'Время не выбрано'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Календарь</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar14
              value={selectedDateValue}
              onChange={(value) => {
                if (!value) return;
                const next = dateToYmd(value);
                if (next !== draft.date) draft.setDate(next);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Статус слотов</CardTitle>
            <CardDescription>06:00 — 22:00 МСК, шаг 30 мин.</CardDescription>
          </CardHeader>
          <CardContent>
            {slotsQuery.isPending && <LoadingSpinner label="Загружаем слоты…" />}
            {slotsQuery.isError && (
              <ErrorMessage message="Не удалось получить слоты на эту дату." />
            )}
            {slotsQuery.data && (
              <SlotGrid
                slots={slotsQuery.data}
                selectedStartAt={draft.slot?.start_at ?? null}
                onSelect={draft.selectSlot}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Button asChild variant="ghost">
          <Link to="/event-types">Назад</Link>
        </Button>
        <div className="flex items-center gap-3">
          {draft.slot && (
            <Badge variant="outline">
              {format(toZonedTime(draft.slot.start_at, MSK), 'HH:mm')} МСК
            </Badge>
          )}
          <Button
            disabled={!draft.slot}
            onClick={() => navigate(`/event-types/${eventTypeId}/book`)}
          >
            Продолжить
          </Button>
        </div>
      </div>
    </section>
  );
}
