import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity via `navigator.onLine` plus the `online`/
 * `offline` window events. This only reflects network reachability — it
 * says nothing about whether app data or future sync features work, since
 * this app is designed to work fully offline by default.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
