import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundRoute() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">Страница не найдена</h1>
      <p className="text-muted-foreground">
        Возможно, ссылка устарела или раздел ещё не готов.
      </p>
      <Button asChild>
        <Link to="/">На главную</Link>
      </Button>
    </section>
  );
}
