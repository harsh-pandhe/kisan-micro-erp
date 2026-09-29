import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog content. Enter/exit motion is done with plain CSS keyed off Radix's
 * own `data-state` attribute (open/closed) rather than `motion`/AnimatePresence,
 * so it works with Radix's built-in mount/unmount timing without extra state
 * threading. Motion is disabled under `prefers-reduced-motion` via the
 * `motion-reduce:` variant, matching the reduced-motion intent already
 * established for route transitions in AppShell.tsx (2048b92).
 */
export function DialogContent({
  className,
  children,
  ...rest
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-150',
          'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
          'motion-reduce:transition-none',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-overlay)] focus:outline-none transition-[opacity,transform] duration-150',
          'data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100',
          'motion-reduce:transition-none motion-reduce:scale-100',
          className,
        )}
        {...rest}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-[var(--radius-sm)] p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-col gap-1 pr-6">{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Title className="text-h3 text-card-foreground">
      {children}
    </DialogPrimitive.Title>
  );
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Description className="text-body-small text-muted-foreground">
      {children}
    </DialogPrimitive.Description>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
