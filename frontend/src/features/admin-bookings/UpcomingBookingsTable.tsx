import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminBookingTime } from '@/lib/formatters';
import type { AdminBooking } from '@/api/types';

interface UpcomingBookingsTableProps {
  bookings: AdminBooking[];
}

export function UpcomingBookingsTable({ bookings }: UpcomingBookingsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата и время (МСК)</TableHead>
          <TableHead>Тип события</TableHead>
          <TableHead>Гость</TableHead>
          <TableHead>E-mail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id} data-booking-id={booking.id}>
            <TableCell>{formatAdminBookingTime(booking.start_at)}</TableCell>
            <TableCell>{booking.event_type_name}</TableCell>
            <TableCell>{booking.guest_name}</TableCell>
            <TableCell>{booking.guest_email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
