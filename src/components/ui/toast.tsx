import { Toast as ToastPrimitive } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from './use-toast';
import type { ToastVariant } from './use-toast';

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success/30 text-success',
  info: 'border-info/30 text-info',
  warning: 'border-warning/30 text-warning',
  error: 'border-danger/30 text-danger',
};

/**
 * Toast viewport + renderer, using Radix Toast for accessible semantics
 * (role="status"/aria-live region via ToastPrimitive.Viewport, dismiss
 * semantics) and `motion` for the enter/exit animation, gated by
 * `useReducedMotion()` — the same convention established for route
 * transitions in AppShell.tsx (2048b92).
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  const reduceMotion = useReducedMotion();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = VARIANT_ICON[t.variant];
          return (
            <ToastPrimitive.Root
              key={t.id}
              asChild
              duration={Infinity}
              onOpenChange={(open) => {
                if (!open) dismiss(t.id);
              }}
            >
              <motion.li
                className={cn(
                  'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-[var(--radius-md)] border bg-card p-3 text-card-foreground shadow-[var(--shadow-overlay)] list-none',
                  VARIANT_CLASSES[t.variant],
                )}
                initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <ToastPrimitive.Title className="text-body-small font-semibold text-foreground">
                    {t.title}
                  </ToastPrimitive.Title>
                  {t.description ? (
                    <ToastPrimitive.Description className="text-caption text-muted-foreground">
                      {t.description}
                    </ToastPrimitive.Description>
                  ) : null}
                </div>
                <ToastPrimitive.Close
                  aria-label="Dismiss"
                  className="rounded-[var(--radius-sm)] p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </ToastPrimitive.Close>
              </motion.li>
            </ToastPrimitive.Root>
          );
        })}
      </AnimatePresence>
      <ToastPrimitive.Viewport
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0"
        aria-live="polite"
      />
    </ToastPrimitive.Provider>
  );
}
