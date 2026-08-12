import { Calendar as CalendarIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AppFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex h-14 items-center justify-between text-sm">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <CalendarIcon className="h-3 w-3" />
          </span>
          Calendar
        </Link>
        <nav className="flex items-center gap-3 text-muted-foreground">
          <Link to="/event-types" className="hover:text-foreground">
            Записаться
          </Link>
          <Link to="/admin/bookings" className="hover:text-foreground">
            Админка
          </Link>
        </nav>
      </div>
    </footer>
  );
}
