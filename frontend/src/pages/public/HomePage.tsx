import { ArrowRight, CalendarDays, Clock, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-4">
        <Badge variant="outline" className="w-fit uppercase tracking-wide">
          Быстрая запись на звонок
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Calendar</h1>
        <p className="text-muted-foreground">
          Забронируйте встречу за минуту: выберите тип события и удобное время.
        </p>
        <Button asChild size="lg" className="w-fit">
          <Link to="/event-types">
            Записаться
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Возможности</CardTitle>
          <CardDescription>Запись на звонок в три шага.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
              <span>Выбор типа события и удобного времени для встречи.</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-primary" />
              <span>Быстрое бронирование с подтверждением по e-mail.</span>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-primary" />
              <span>Управление типами событий и просмотр предстоящих записей в админке.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
