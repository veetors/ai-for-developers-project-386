import { Link } from 'react-router-dom';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EventType } from '@/api/types';

export function EventTypeCard({ eventType }: { eventType: EventType }) {
  return (
    <Link
      to={`/event-types/${eventType.id}`}
      className="block transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg"
    >
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-4 w-4 text-primary" />
              {eventType.name}
            </CardTitle>
          </div>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {eventType.duration_minutes} мин
          </Badge>
        </CardHeader>
        <CardContent>
          <CardDescription>{eventType.description || 'Описание не указано.'}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
