import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAdminEventTypes } from '@/features/admin-event-types/useAdminEventTypes';
import { useDeleteEventType } from '@/features/admin-event-types/useDeleteEventType';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { EventType } from '@/api/types';

export function AdminEventTypesPage() {
  const navigate = useNavigate();
  const query = useAdminEventTypes();
  const remove = useDeleteEventType();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setPendingId(id);
    try {
      await remove.mutateAsync(id);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Типы событий</h1>
          <p className="text-sm text-muted-foreground">Шаблоны встреч, доступные гостям.</p>
        </div>
        <Button asChild>
          <Link to="/admin/event-types/new">Создать тип</Link>
        </Button>
      </header>

      {query.isPending && <LoadingSpinner label="Загружаем типы событий…" />}
      {query.isError && <ErrorMessage message="Не удалось получить типы событий." />}

      {query.data && query.data.length === 0 && (
        <EmptyState
          title="Типы событий ещё не созданы"
          description="Создайте первый шаблон встречи."
          action={
            <Button asChild>
              <Link to="/admin/event-types/new">Создать тип</Link>
            </Button>
          }
        />
      )}

      {query.data && query.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead>Длительность</TableHead>
              <TableHead className="w-48 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((eventType: EventType) => (
              <TableRow key={eventType.id} data-event-type-id={eventType.id}>
                <TableCell className="font-medium">{eventType.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {eventType.description || '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{eventType.duration_minutes} мин</Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/event-types/${eventType.id}`}>Редактировать</Link>
                  </Button>
                  <DeleteControl
                    eventType={eventType}
                    pending={pendingId === eventType.id}
                    onConfirm={() => handleDelete(eventType.id)}
                    onNavigate={() => navigate(`/admin/event-types/${eventType.id}`)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function DeleteControl({
  eventType,
  pending,
  onConfirm,
  onNavigate,
}: {
  eventType: EventType;
  pending: boolean;
  onConfirm: () => void;
  onNavigate: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          data-action="delete-event-type"
        >
          Удалить
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить «{eventType.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Уже созданные бронирования сохранятся, но новые записи на этот тип станут невозможны.
            Чтобы изменить параметры, лучше{' '}
            <button
              type="button"
              onClick={onNavigate}
              className="text-primary underline-offset-4 hover:underline"
            >
              отредактировать
            </button>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Удалить</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
