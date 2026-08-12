import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatSlotRangeInMsk } from '@/lib/formatters';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { Slot } from '@/api/types';

interface SlotGridProps {
  slots: Slot[];
  selectedStartAt: string | null;
  onSelect: (slot: Slot) => void;
}

const MSK = 'Europe/Moscow';

function isPast(slot: Slot, now: Date): boolean {
  const zoned = toZonedTime(slot.start_at, MSK);
  return zoned.getTime() < now.getTime();
}

export function SlotGrid({ slots, selectedStartAt, onSelect }: SlotGridProps) {
  const now = new Date();

  return (
    <div className="flex flex-col gap-2">
      {slots.length === 0 && (
        <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
          Нет слотов на выбранную дату.
        </div>
      )}
      {slots.map((slot) => {
        const busy = slot.status === 'busy' || isPast(slot, now);
        const isSelected = selectedStartAt === slot.start_at;
        const time = format(toZonedTime(slot.start_at, MSK), 'HH:mm');
        return (
          <Button
            key={slot.start_at}
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => !busy && onSelect(slot)}
            data-status={busy ? 'busy' : 'free'}
            data-selected={isSelected ? 'true' : 'false'}
            className={cn(
              'h-auto justify-between px-3 py-2 text-left',
              isSelected && 'ring-2 ring-primary',
            )}
          >
            <span className="text-sm">{formatSlotRangeInMsk(slot.start_at, slot.end_at)}</span>
            <span className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{time}</span>
              <Badge variant={busy ? 'secondary' : 'success'}>{busy ? 'Занято' : 'Свободно'}</Badge>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
