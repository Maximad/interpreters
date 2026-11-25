import type { ComponentProps } from 'react';
import { cn } from './utils';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn('w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm', className)}
    />
  );
}
