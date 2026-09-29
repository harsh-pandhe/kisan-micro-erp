import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/**
 * Bottom-sheet-style dialog: slides up from the bottom edge on mobile
 * (matching the app's mobile-first bottom-nav layout), and behaves as a
 * standard centered-ish anchored panel on wider screens via `sm:` overrides.
 * Built on Radix Dialog so it gets the same focus-trap/Escape/aria behavior
 * as `dialog.tsx`.
 */
export function SheetContent({ className, children, ...rest }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-150',
          'data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-xl)] border-t border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-[var(--shadow-overlay)] focus:outline-none transition-transform duration-200',
          'data-[state=closed]:translate-y-full data-[state=open]:translate-y-0',
          'sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:rounded-[var(--radius-lg)]',
          'sm:data-[state=closed]:-translate-y-1/2 sm:data-[state=closed]:translate-x-[-50%] sm:data-[state=closed]:scale-95 sm:data-[state=closed]:opacity-0',
          'sm:data-[state=open]:-translate-y-1/2 sm:data-[state=open]:translate-x-[-50%] sm:data-[state=open]:scale-100 sm:data-[state=open]:opacity-100',
          'motion-reduce:transition-none',
          className,
        )}
        {...rest}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden"
          aria-hidden="true"
        />
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

export function SheetHeader({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-col gap-1 pr-6">{children}</div>;
}
export function SheetTitle({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Title className="text-h3 text-card-foreground">
      {children}
    </DialogPrimitive.Title>
  );
}
export function SheetDescription({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Description className="text-body-small text-muted-foreground">
      {children}
    </DialogPrimitive.Description>
  );
}
