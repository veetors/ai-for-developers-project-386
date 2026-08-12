import { Link, Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { queryClient } from '@/app/query-client';
import { AppErrorBoundary } from '@/app/error-boundary';
import { BookingDraftProvider } from '@/features/public-booking/BookingDraftContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { HomePage } from '@/pages/public/HomePage';
import { EventTypesPage } from '@/pages/public/EventTypesPage';
import { EventTypeSlotsPage } from '@/pages/public/EventTypeSlotsPage';
import { BookingFormPage } from '@/pages/public/BookingFormPage';
import { BookingSuccessPage } from '@/pages/public/BookingSuccessPage';
import { AdminBookingsPage } from '@/pages/admin/AdminBookingsPage';
import { AdminEventTypesPage } from '@/pages/admin/AdminEventTypesPage';
import { AdminEventTypeNewPage } from '@/pages/admin/AdminEventTypeNewPage';
import { AdminEventTypeEditPage } from '@/pages/admin/AdminEventTypeEditPage';
import { NotFoundRoute } from '@/pages/public/NotFoundRoute';

const PublicLayout = () => (
  <div className="flex min-h-screen flex-col">
    <AppHeader />
    <main className="container flex-1 py-8">
      <Outlet />
    </main>
    <AppFooter />
  </div>
);

const AdminLayout = () => (
  <div className="flex min-h-screen flex-col">
    <AppHeader variant="admin" />
    <main className="container flex-1 py-8">
      <Outlet />
    </main>
    <AppFooter />
  </div>
);

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/event-types', element: <EventTypesPage /> },
      { path: '/event-types/:id', element: <EventTypeSlotsPage /> },
      { path: '/event-types/:id/book', element: <BookingFormPage /> },
      { path: '/event-types/:id/success', element: <BookingSuccessPage /> },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      { path: '/admin', element: <Navigate to="/admin/bookings" replace /> },
      { path: '/admin/bookings', element: <AdminBookingsPage /> },
      { path: '/admin/event-types', element: <AdminEventTypesPage /> },
      { path: '/admin/event-types/new', element: <AdminEventTypeNewPage /> },
      { path: '/admin/event-types/:id', element: <AdminEventTypeEditPage /> },
    ],
  },
]);

// Re-export for tree-shaking-friendly Link usage if needed
export { Link };

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <BookingDraftProvider>
          <RouterProvider router={router} />
          <Toaster />
        </BookingDraftProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}
