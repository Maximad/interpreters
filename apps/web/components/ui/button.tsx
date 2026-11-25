import type { ComponentProps } from 'react';
import { cn } from './utils';

export function Button({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-medium text-white',
        'transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
