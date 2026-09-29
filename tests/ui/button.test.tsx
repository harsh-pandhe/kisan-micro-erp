import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UiButton } from '../../src/components/ui/button';

describe('UiButton', () => {
  it('renders variant and size classes', () => {
    render(
      <UiButton variant="destructive" size="lg">
        Delete
      </UiButton>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('bg-danger');
    expect(btn.className).toContain('h-12');
  });

  it('is disabled and shows a spinner while loading, and blocks clicks', async () => {
    const onClick = vi.fn();
    render(
      <UiButton loading onClick={onClick}>
        Save
      </UiButton>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.querySelector('svg')).toBeTruthy();

    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports the disabled state independent of loading', () => {
    render(<UiButton disabled>Save</UiButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
