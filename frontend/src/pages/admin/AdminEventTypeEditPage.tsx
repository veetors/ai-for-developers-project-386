import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAdminEventType } from '@/features/admin-event-types/useAdminEventType';
import { EventTypeForm } from '@/features/admin-event-types/EventTypeForm';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { Button } from '@/components/ui/button';

export function AdminEventTypeEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = Number.isInteger(id) && id > 0;
  const query = useAdminEventType(isValidId ? id : NaN);

  if (!isValidId) {
    return <Navigate to="/admin/event-types" replace />;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Редактирование типа события</h1>
          <p className="text-sm text-muted-foreground">
            Измените название и описание. Длительность фиксирована.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link to="/admin/event-types">К списку</Link>
        </Button>
      </header>

      {query.isPending && <LoadingSpinner label="Загружаем тип события…" />}
      {query.isError && <ErrorMessage message="Не удалось получить тип события." />}

      {query.data && (
        <EventTypeForm
          mode="edit"
          eventTypeId={query.data.id}
          initial={{ name: query.data.name, description: query.data.description }}
          onSuccess={() => navigate('/admin/event-types')}
        />
      )}
    </section>
  );
}
