import { cloneElement, useId } from 'react';
import type { ReactElement } from 'react';
import { cn } from '../../lib/utils';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** The single form control (Input/Textarea/Select trigger, etc). Receives
   * `id`, `aria-describedby`, `aria-invalid` and `disabled` wired up. */
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    disabled?: boolean;
  }>;
  className?: string;
}

/**
 * Consistent Label + control + Hint/Error wrapper with accessible
 * association (htmlFor/id/aria-describedby/aria-invalid), so future forms
 * don't hand-roll this each time. Not yet used by any existing page.
 */
export function Field({ label, hint, error, disabled, children, className }: FieldProps) {
  const id = useId();
  const controlId = `field-${id}`;
  const hintId = hint ? `field-${id}-hint` : undefined;
  const errorId = error ? `field-${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-label text-foreground">
        {label}
      </label>
      {cloneControl(children, { id: controlId, describedBy, invalid: !!error, disabled })}
      {hint && !error ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function cloneControl(
  child: FieldProps['children'],
  opts: { id: string; describedBy?: string; invalid: boolean; disabled?: boolean },
): ReactElement {
  return cloneElement(child, {
    id: opts.id,
    'aria-describedby': opts.describedBy,
    'aria-invalid': opts.invalid || undefined,
    disabled: opts.disabled ?? child.props.disabled,
  });
}
