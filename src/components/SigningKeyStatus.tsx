import { useEffect, useState } from 'react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { generateNewSigningKey, getOrCreateSigningKey, keyFingerprint } from '../features/crypto';

type Status =
  { kind: 'loading' } | { kind: 'ready'; fingerprint: string } | { kind: 'error'; message: string };

/**
 * Settings-page signing-key status. Shows only the public fingerprint —
 * never the private key material. "Generate signing key" only appears
 * once, on first use; after that, "Generate new signing key" is offered
 * as an explicit, confirmed reset action (see docs/milestone-9.md, "Key
 * reset").
 */
export function SigningKeyStatus() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [initialized, setInitialized] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { publicKey } = await getOrCreateSigningKey();
        setStatus({ kind: 'ready', fingerprint: keyFingerprint(publicKey) });
        setInitialized(true);
      } catch (cause) {
        setStatus({
          kind: 'error',
          message:
            cause instanceof Error ? cause.message : 'Could not access the signing key store.',
        });
      }
    })();
  }, []);

  async function handleResetKey() {
    const confirmed = window.confirm(
      'Generate a new signing key? Backups signed with the old key remain valid and stay tied to the ' +
        'old key’s fingerprint — this does not invalidate them, but future exports will be signed ' +
        'with the new key instead.',
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      const { publicKey } = await generateNewSigningKey();
      setStatus({ kind: 'ready', fingerprint: keyFingerprint(publicKey) });
    } catch (cause) {
      setStatus({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Failed to generate a new signing key.',
      });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="stack-gap">
      {status.kind === 'loading' ? (
        <p role="status" aria-live="polite" className="card-note">
          Checking signing key…
        </p>
      ) : null}

      {status.kind === 'ready' && initialized ? (
        <p role="status" aria-live="polite" className="card-note">
          <StatusBadge tone="positive">Key available</StatusBadge> Fingerprint: {status.fingerprint}
        </p>
      ) : null}

      {status.kind === 'error' ? (
        <p role="alert" className="card-note">
          <StatusBadge tone="warning">Not initialized</StatusBadge> {status.message}
        </p>
      ) : null}

      <p className="card-note">
        This key never leaves your device and is not included in any backup file. Losing it (e.g.
        clearing browser data) means future signatures from this identity can't be recreated — there
        is no key recovery.
      </p>

      <Button
        type="button"
        variant="ghost"
        onClick={() => void handleResetKey()}
        disabled={resetting}
      >
        {resetting ? 'Generating…' : 'Generate new signing key'}
      </Button>
    </div>
  );
}
