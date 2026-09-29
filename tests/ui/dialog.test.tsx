import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '../../src/components/ui/dialog';

/** Same `prefers-reduced-motion` mocking pattern as elsewhere in this app
 * (see AppShell's `useReducedMotion()` usage) — jsdom has no real
 * matchMedia, so tests must stub it themselves. */
function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Example() {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete account</DialogTitle>
        <DialogDescription>This cannot be undone.</DialogDescription>
        <button>Confirm</button>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on trigger click, traps focus, and closes on Escape', async () => {
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.queryByText('Delete account')).not.toBeInTheDocument();

    await user.click(screen.getByText('Open'));
    expect(await screen.findByText('Delete account')).toBeInTheDocument();

    // Focus should have moved into the dialog (Radix focus trap).
    await waitFor(() => {
      expect(document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Delete account')).not.toBeInTheDocument();
    });
  });

  it('renders correctly with reduced motion active', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByText('Open'));
    expect(await screen.findByText('Delete account')).toBeInTheDocument();
  });
});
