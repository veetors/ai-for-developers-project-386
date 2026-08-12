import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Slot } from '@/api/types';

export interface BookingDraftValue {
  eventTypeId: number | null;
  date: string | null;
  slot: Slot | null;
  setEventType: (eventTypeId: number) => void;
  setDate: (date: string) => void;
  selectSlot: (slot: Slot | null) => void;
  clear: () => void;
}

const EMPTY_VALUE: Pick<BookingDraftValue, 'eventTypeId' | 'date' | 'slot'> = {
  eventTypeId: null,
  date: null,
  slot: null,
};

const BookingDraftContext = createContext<BookingDraftValue | null>(null);

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [eventTypeId, setEventTypeId] = useState<number | null>(EMPTY_VALUE.eventTypeId);
  const [date, setDateState] = useState<string | null>(EMPTY_VALUE.date);
  const [slot, setSlot] = useState<Slot | null>(EMPTY_VALUE.slot);

  const setEventType = useCallback((nextId: number) => {
    setEventTypeId(nextId);
    setDateState(null);
    setSlot(null);
  }, []);

  const setDate = useCallback((nextDate: string) => {
    setDateState(nextDate);
    setSlot(null);
  }, []);

  const selectSlot = useCallback((nextSlot: Slot | null) => {
    setSlot(nextSlot);
  }, []);

  const clear = useCallback(() => {
    setEventTypeId(null);
    setDateState(null);
    setSlot(null);
  }, []);

  const value = useMemo<BookingDraftValue>(
    () => ({ eventTypeId, date, slot, setEventType, setDate, selectSlot, clear }),
    [eventTypeId, date, slot, setEventType, setDate, selectSlot, clear],
  );

  return <BookingDraftContext.Provider value={value}>{children}</BookingDraftContext.Provider>;
}

export function useBookingDraft(): BookingDraftValue {
  const ctx = useContext(BookingDraftContext);
  if (!ctx) {
    throw new Error('useBookingDraft must be used inside BookingDraftProvider');
  }
  return ctx;
}
