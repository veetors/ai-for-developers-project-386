import type { ErrorBody, ErrorCode } from './types';

export class AppError extends Error {
  readonly status: number;
  readonly body: ErrorBody;

  constructor(status: number, body: ErrorBody) {
    super(body.message || `Request failed with status ${status}`);
    this.name = 'AppError';
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  validation_failed: 'Проверьте правильность заполнения полей.',
  slot_outside_window: 'Выбранная дата вне доступного окна (14 дней).',
  slot_outside_hours: 'Время вне рабочего диапазона 06:00–22:00 МСК.',
  slot_in_past: 'Это время уже прошло.',
  slot_taken: 'Слот только что заняли. Выберите другое время.',
  event_type_not_found: 'Тип события не найден.',
  booking_not_found: 'Бронирование не найдено.',
  invalid_duration: 'Длительность должна быть 30 минут.',
  internal_error: 'Внутренняя ошибка сервера.',
};

export function errorMessageFor(body: ErrorBody | { code: ErrorCode; message?: string }): string {
  return body.message?.trim() || DEFAULT_MESSAGES[body.code] || 'Неизвестная ошибка.';
}

export type FieldErrors = Record<string, string[]>;

export function toFieldErrors(error: AppError): FieldErrors {
  if (!error.body.details?.length) {
    return {};
  }
  const out: FieldErrors = {};
  for (const detail of error.body.details) {
    if (!detail.field || !detail.messages?.length) continue;
    out[detail.field] = [...(out[detail.field] ?? []), ...detail.messages];
  }
  return out;
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
