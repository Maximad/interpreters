import type { ComponentProps } from 'react';
import { cn } from './utils';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn('min-h-11 min-w-0 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base', className)}
    />
  );
}
