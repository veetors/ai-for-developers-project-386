import { Calendar as CalendarIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  variant?: 'public' | 'admin';
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
  );

export function AppHeader({ variant = 'public' }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CalendarIcon className="h-4 w-4" />
          </span>
          Calendar
        </Link>
        <nav className="flex items-center gap-1">
          {variant === 'public' ? (
            <>
              <NavLink to="/event-types" className={navLinkClass}>
                Записаться
              </NavLink>
              <NavLink to="/admin/bookings" className={navLinkClass}>
                Админка
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/admin/bookings" className={navLinkClass}>
                Бронирования
              </NavLink>
              <NavLink to="/admin/event-types" className={navLinkClass}>
                Типы событий
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
