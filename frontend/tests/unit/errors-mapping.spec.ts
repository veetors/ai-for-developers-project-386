import { describe, expect, it } from 'vitest';
import { AppError, errorMessageFor, toFieldErrors } from '@/api/errors';

describe('errorMessageFor', () => {
  it('falls back to russian default for known code', () => {
    expect(errorMessageFor({ code: 'slot_taken', message: '' })).toContain('Слот только что заняли');
    expect(errorMessageFor({ code: 'slot_outside_window' })).toContain('14');
  });

  it('prefers server message when present', () => {
    expect(errorMessageFor({ code: 'slot_taken', message: 'Локальное сообщение' })).toBe(
      'Локальное сообщение',
    );
  });

  it('falls back for unknown code', () => {
    expect(
      errorMessageFor({ code: 'marker_xyz' as unknown as 'slot_taken', message: '' }),
    ).toBe('Неизвестная ошибка.');
  });
});

describe('AppError', () => {
  it('keeps status and body', () => {
    const err = new AppError(409, { code: 'slot_taken', message: 'busy' });
    expect(err.status).toBe(409);
    expect(err.body.code).toBe('slot_taken');
    expect(err.message).toBe('busy');
  });
});

describe('toFieldErrors', () => {
  it('aggregates details by field', () => {
    const err = new AppError(422, {
      code: 'validation_failed',
      message: 'bad',
      details: [
        { field: 'guest_email', messages: ['Неверный формат', 'Слишком короткий'] },
        { field: 'guest_email', messages: ['Ещё одна'] },
        { field: 'guest_name', messages: ['Пусто'] },
      ],
    });
    const out = toFieldErrors(err);
    expect(out.guest_email).toEqual(['Неверный формат', 'Слишком короткий', 'Ещё одна']);
    expect(out.guest_name).toEqual(['Пусто']);
  });

  it('returns empty object if details absent', () => {
    expect(toFieldErrors(new AppError(409, { code: 'slot_taken', message: '...' }))).toEqual({});
  });
});
