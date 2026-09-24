import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { StatusBadge } from './StatusBadge';

/**
 * Reusable connectivity indicator. This app works without a network
 * connection by design; this component just surfaces the current state,
 * it does not gate any functionality.
 */
export function OfflineStatus() {
  const isOnline = useOnlineStatus();

  return (
    <StatusBadge tone={isOnline ? 'positive' : 'warning'}>
      {isOnline ? 'Online' : 'Offline — data stays on this device'}
    </StatusBadge>
  );
}
