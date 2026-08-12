import { describe, expect, it } from 'vitest';
import { formatSlotRangeInMsk } from '@/lib/formatters';
import { formatAdminBookingTime } from '@/lib/formatters';

describe('formatSlotRangeInMsk', () => {
  it('formats start..end as HH:mm — HH:mm in Moscow', () => {
    expect(
      formatSlotRangeInMsk('2026-08-12T06:00:00+03:00', '2026-08-12T06:30:00+03:00'),
    ).toBe('06:00 — 06:30');
  });

  it('accepts UTC ISO (converted to MSK)', () => {
    expect(
      formatSlotRangeInMsk('2026-08-12T03:00:00Z', '2026-08-12T03:30:00Z'),
    ).toBe('06:00 — 06:30');
  });

  it('rolls past midnight in inverse TZ', () => {
    expect(
      formatSlotRangeInMsk('2026-08-12T21:30:00Z', '2026-08-12T22:00:00Z'),
    ).toBe('00:30 — 01:00');
  });
});

describe('formatAdminBookingTime', () => {
  it('renders long-form datetime in ru-RU', () => {
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00')).toContain('9:30');
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00')).toMatch(/августа|31/);
  });
});
