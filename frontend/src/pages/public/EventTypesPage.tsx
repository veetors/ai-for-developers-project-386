import { Briefcase } from 'lucide-react';
import { useEventTypes } from '@/features/public-catalog/useEventTypes';
import { EventTypeCard } from '@/features/public-catalog/EventTypeCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function EventTypesPage() {
  const query = useEventTypes();

  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Calendar · Host</p>
              <CardTitle>Выберите тип события</CardTitle>
            </div>
          </div>
          <CardDescription>
            Нажмите на карточку, чтобы открыть календарь и выбрать удобный слот.
          </CardDescription>
        </CardHeader>
      </Card>

      {query.isPending && <LoadingSpinner label="Загружаем типы событий…" />}
      {query.isError && <ErrorMessage message="Не удалось получить каталог типов событий." />}

      {query.data && query.data.length === 0 && (
        <EmptyState
          title="Типы событий пока не созданы"
          description="Владелец ещё не добавил ни одного типа события."
        />
      )}

      {query.data && query.data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.map((eventType) => (
            <EventTypeCard key={eventType.id} eventType={eventType} />
          ))}
        </div>
      )}
    </section>
  );
}
