import type { ComponentProps } from 'react';
import { cn } from './utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'min-h-11 min-w-0 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'aria-[invalid=true]:border-red-500',
        className
      )}
      {...props}
    />
  );
}
