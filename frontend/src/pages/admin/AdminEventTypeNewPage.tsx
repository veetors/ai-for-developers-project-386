import { useNavigate } from 'react-router-dom';
import { EventTypeForm } from '@/features/admin-event-types/EventTypeForm';

export function AdminEventTypeNewPage() {
  const navigate = useNavigate();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Новый тип события</h1>
        <p className="text-sm text-muted-foreground">
          Заполните название и описание. Длительность фиксирована — 30 минут.
        </p>
      </header>
      <EventTypeForm
        mode="create"
        onSuccess={() => {
          navigate('/admin/event-types');
        }}
      />
    </section>
  );
}
