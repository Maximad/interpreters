import type { InputHTMLAttributes } from 'react';
import { cn } from './utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'aria-[invalid=true]:border-red-500',
        className
      )}
      {...props}
    />
  );
}
