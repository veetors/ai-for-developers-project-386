import { useMemo } from 'react';
import { addDaysMsk, todayInMsk } from '@/api/time';
import { Calendar } from '@/components/ui/calendar';

interface Calendar14Props {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}

export function Calendar14({ value, onChange }: Calendar14Props) {
  const { from, to } = useMemo(() => {
    const fromDate = todayInMsk();
    const toDate = addDaysMsk(fromDate, 13);
    return { from: new Date(`${fromDate}T00:00:00`), to: new Date(`${toDate}T00:00:00`) };
  }, []);

  return (
    <Calendar
      mode="single"
      selected={value}
      onSelect={onChange}
      disabled={{ before: from, after: to }}
      fromDate={from}
      toDate={to}
      defaultMonth={value ?? from}
    />
  );
}
