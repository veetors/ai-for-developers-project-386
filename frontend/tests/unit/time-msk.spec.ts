import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysMsk, isWithinBookingWindow, todayInMsk } from '@/api/time';

describe('MSK time helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('todayInMsk', () => {
    it('returns date in MSK regardless of system timezone', () => {
      vi.setSystemTime(new Date('2026-08-12T22:00:00Z')); // 01:00 MSK следующего дня
      expect(todayInMsk()).toBe('2026-08-13');
    });

    it('does not change around MSK midnight when system clock is UTC', () => {
      vi.setSystemTime(new Date('2026-08-12T20:59:00Z')); // 23:59 MSK того же дня
      expect(todayInMsk()).toBe('2026-08-12');
      vi.setSystemTime(new Date('2026-08-12T21:01:00Z')); // 00:01 MSK следующего дня
      expect(todayInMsk()).toBe('2026-08-13');
    });
  });

  describe('addDaysMsk', () => {
    it('keeps MSK semantics when system clock is far away', () => {
      vi.setSystemTime(new Date('2026-09-01T01:00:00Z'));
      expect(addDaysMsk('2026-08-30', 1)).toBe('2026-08-31');
      expect(addDaysMsk('2026-08-30', 5)).toBe('2026-09-04');
      expect(addDaysMsk('2026-12-31', 1)).toBe('2027-01-01');
    });
  });

  describe('isWithinBookingWindow', () => {
    it('includes today and today+13', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-12')).toBe(true);
      expect(isWithinBookingWindow('2026-08-25')).toBe(true);
    });

    it('excludes past and beyond', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-11')).toBe(false);
      expect(isWithinBookingWindow('2026-08-26')).toBe(false);
    });
  });
});
