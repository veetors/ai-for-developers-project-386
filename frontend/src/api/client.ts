import createClient from 'openapi-fetch';
import { AppError } from './errors';
import type { paths } from './generated/schema';
import type { ErrorBody } from './types';

interface RawErrorBody {
  error?: ErrorBody;
}

function unwrapErrorBody(raw: unknown): ErrorBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as RawErrorBody;
  if (candidate.error && typeof candidate.error === 'object' && typeof candidate.error.code === 'string') {
    return candidate.error;
  }
  const direct = raw as Partial<ErrorBody>;
  if (typeof direct.code === 'string' && typeof direct.message === 'string') {
    return direct as ErrorBody;
  }
  return null;
}

const errorMiddleware = {
  async onResponse({ response }: { response: Response }) {
    if (response.ok) return;
    let body: ErrorBody | null = null;
    try {
      const raw = await response.clone().json();
      body = unwrapErrorBody(raw);
    } catch {
      body = null;
    }
    const fallback: ErrorBody = {
      code: 'internal_error',
      message: response.statusText || `Request failed (${response.status})`,
    };
    throw new AppError(response.status, body ?? fallback);
  },
};

export const api = createClient<paths>({
  baseUrl: '',
});

api.use(errorMiddleware);

