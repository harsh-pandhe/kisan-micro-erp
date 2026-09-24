import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { OfflineStatus } from '../src/components/OfflineStatus';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('OfflineStatus', () => {
  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it('shows online when navigator.onLine is true', () => {
    setOnline(true);
    render(<OfflineStatus />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows offline messaging when navigator.onLine is false', () => {
    setOnline(false);
    render(<OfflineStatus />);
    expect(screen.getByText('Offline — data stays on this device')).toBeInTheDocument();
  });

  it('reacts to offline/online window events', () => {
    setOnline(true);
    render(<OfflineStatus />);
    expect(screen.getByText('Online')).toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Offline — data stays on this device')).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
