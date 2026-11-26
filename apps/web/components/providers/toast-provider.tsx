'use client';

import * as Toast from '@radix-ui/react-toast';
import { createContext, useContext, useState, type ReactNode } from 'react';

type ToastState = { open: boolean; title: string; description?: string; tone?: 'success' | 'error' };

const ToastContext = createContext<{ showToast: (t: Omit<ToastState, 'open'>) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ open: false, title: '' });

  return (
    <ToastContext.Provider
      value={{ showToast: (next) => setToast({ ...next, open: true }) }}
    >
      <Toast.Provider swipeDirection="right">
        {children}
        <Toast.Root
          className={`w-full rounded-md border p-4 shadow-lg ${toast.tone === 'error' ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}
          open={toast.open}
          onOpenChange={(open) => setToast((prev) => ({ ...prev, open }))}
        >
          <Toast.Title className="text-sm font-semibold">{toast.title}</Toast.Title>
          {toast.description ? <Toast.Description className="text-sm text-slate-700">{toast.description}</Toast.Description> : null}
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-4 end-4 start-4 z-50 m-0 grid list-none gap-2 p-0 sm:start-auto sm:w-96" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}
