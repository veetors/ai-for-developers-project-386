import { useAdminBookings } from '@/features/admin-bookings/useAdminBookings';
import { UpcomingBookingsTable } from '@/features/admin-bookings/UpcomingBookingsTable';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';

export function AdminBookingsPage() {
  const query = useAdminBookings();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Предстоящие бронирования</h1>
        <p className="text-sm text-muted-foreground">
          Все записи по всем типам событий в одном списке, отсортированы по времени (МСК).
        </p>
      </header>

      {query.isPending && <LoadingSpinner label="Загружаем бронирования…" />}
      {query.isError && <ErrorMessage message="Не удалось получить список бронирований." />}

      {query.data && query.data.length === 0 && (
        <EmptyState
          title="Бронирований пока нет"
          description="Когда гости начнут записываться, они появятся здесь."
        />
      )}

      {query.data && query.data.length > 0 && <UpcomingBookingsTable bookings={query.data} />}
    </section>
  );
}
