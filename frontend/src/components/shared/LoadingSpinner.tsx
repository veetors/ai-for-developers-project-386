import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingSpinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-muted-foreground', className)}>
      <Loader2 className="h-5 w-5 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
