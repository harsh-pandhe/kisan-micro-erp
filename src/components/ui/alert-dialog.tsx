import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

/** For destructive confirmations (e.g. restore-from-backup). Unlike Dialog,
 * AlertDialog cannot be dismissed by clicking outside — it requires an
 * explicit action or cancel, per Radix's accessible pattern for
 * irreversible actions. */
export function AlertDialogContent({
  className,
  children,
  ...rest
}: AlertDialogPrimitive.AlertDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-150',
          'data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none',
        )}
      />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border bg-card p-5 text-card-foreground shadow-[var(--shadow-overlay)] focus:outline-none transition-[opacity,transform] duration-150',
          'data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none motion-reduce:scale-100',
          className,
        )}
        {...rest}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-col gap-1">{children}</div>;
}
export function AlertDialogTitle({ children }: { children: ReactNode }) {
  return (
    <AlertDialogPrimitive.Title className="text-h3 text-card-foreground">
      {children}
    </AlertDialogPrimitive.Title>
  );
}
export function AlertDialogDescription({ children }: { children: ReactNode }) {
  return (
    <AlertDialogPrimitive.Description className="text-body-small text-muted-foreground">
      {children}
    </AlertDialogPrimitive.Description>
  );
}
export function AlertDialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>;
}
