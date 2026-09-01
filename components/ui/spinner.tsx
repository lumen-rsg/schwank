import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';

function Spinner({ className, ...props }: React.ComponentProps<'output'>) {
  return (
    <output
      data-slot="spinner"
      aria-live="polite"
      className={cn('inline-flex', className)}
      {...props}
    >
      <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
      <span className="sr-only">Loading</span>
    </output>
  );
}

export { Spinner };
