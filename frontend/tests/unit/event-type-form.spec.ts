import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Укажите название.')
    .max(200, 'Не более 200 символов.'),
  description: z.string().trim().max(2000, 'Слишком длинное описание.'),
  duration_minutes: z.literal(30),
});

type FormValues = z.infer<typeof formSchema>;

describe('EventType form schema', () => {
  it('accepts valid data with duration_minutes=30', () => {
    const parsed = formSchema.safeParse({
      name: 'Встреча 30 минут',
      description: 'Базовый тип',
      duration_minutes: 30,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = formSchema.safeParse({
      name: '   ',
      description: '',
      duration_minutes: 30,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('name');
    }
  });

  it('rejects non-30 duration', () => {
    const result = formSchema.safeParse({
      name: 'Встреча',
      description: '',
      duration_minutes: 45,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('duration_minutes');
    }
  });

  it('accepts arbitrary description (no validation beyond length)', () => {
    const parsed = formSchema.safeParse({
      name: 'Встреча',
      description: 'любой текст',
      duration_minutes: 30,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const v: FormValues = parsed.data;
      expect(v.description).toBe('любой текст');
    }
  });

  it('rejects too long name (>200)', () => {
    const result = formSchema.safeParse({
      name: 'x'.repeat(201),
      description: '',
      duration_minutes: 30,
    });
    expect(result.success).toBe(false);
  });
});
