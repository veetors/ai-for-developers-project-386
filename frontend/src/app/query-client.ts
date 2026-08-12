import { QueryClient } from '@tanstack/react-query';
import { AppError } from '@/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error: unknown) => {
        if (error instanceof AppError && error.status < 500) {
          return false;
        }
        return count < 1;
      },
    },
  },
});
