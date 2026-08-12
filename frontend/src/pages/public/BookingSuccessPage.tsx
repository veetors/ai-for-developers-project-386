import { Link, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { BookingConfirmation } from '@/api/types';
import { BOOKING_LAST_KEY } from '@/features/public-booking/useCreateBooking';
import {
  formatAdminBookingTime,
  formatDateInMsk,
  formatSlotRangeInMsk,
} from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function BookingSuccessPage() {
  const params = useParams<{ id: string }>();
  const eventTypeId = Number(params.id);
  const isValidId = Number.isInteger(eventTypeId) && eventTypeId > 0;
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BOOKING_LAST_KEY);
      if (!raw) {
        setConfirmation(null);
        return;
      }
      const parsed = JSON.parse(raw) as BookingConfirmation;
      if (parsed.event_type?.id !== eventTypeId) {
        setConfirmation(null);
        return;
      }
      setConfirmation(parsed);
    } catch {
      setConfirmation(null);
    }
  }, [eventTypeId]);

  if (!isValidId) {
    return <Navigate to="/event-types" replace />;
  }

  if (confirmation === undefined) {
    return (
      <section className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Загрузка…</CardTitle>
          </CardHeader>
        </Card>
      </section>
    );
  }

  if (confirmation === null) {
    return (
      <section className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Бронирование не найдено</CardTitle>
            <CardDescription>
              Подтверждение действует только пока вы находитесь на этой странице.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/event-types">Записаться ещё раз</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <CardTitle>Бронирование подтверждено</CardTitle>
              <CardDescription>Номер брони #{confirmation.id}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Тип события" value={confirmation.event_type.name} />
          <Row label="Дата" value={formatDateInMsk(confirmation.start_at)} />
          <Row label="Время" value={formatSlotRangeInMsk(confirmation.start_at, confirmation.end_at)} />
          <Row label="Гость" value={confirmation.guest_name} />
          <Row label="E-mail" value={confirmation.guest_email} />
          <Row label="Создано" value={formatAdminBookingTime(confirmation.created_at)} />
        </CardContent>
      </Card>
      <Button asChild className="self-start">
        <Link to="/event-types">Записаться ещё</Link>
      </Button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
