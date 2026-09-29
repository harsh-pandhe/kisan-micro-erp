import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../../src/components/ui/field';
import { UiInput } from '../../src/components/ui/input';

describe('Field', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(
      <Field label="Amount">
        <UiInput />
      </Field>,
    );
    const input = screen.getByLabelText('Amount');
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it('wires an error to aria-invalid and aria-describedby', () => {
    render(
      <Field label="Amount" error="Amount is required">
        <UiInput />
      </Field>,
    );
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('Amount is required');
    expect(document.getElementById(describedBy!.split(' ')[0])).toHaveTextContent(
      'Amount is required',
    );
  });

  it('propagates disabled to the control', () => {
    render(
      <Field label="Amount" disabled>
        <UiInput />
      </Field>,
    );
    expect(screen.getByLabelText('Amount')).toBeDisabled();
  });
});
