import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../lib/utils';

export type VoiceLanguage = 'en-IN' | 'hi-IN';

interface VoiceInputButtonProps {
  /** Called with the transcribed text once recognition finishes. */
  onResult: (text: string) => void;
  language: VoiceLanguage;
  onLanguageChange: (language: VoiceLanguage) => void;
  disabled?: boolean;
}

// Not every browser exposes SpeechRecognition under the standard name.
type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Microphone button that transcribes speech via the browser's native
 * SpeechRecognition API and hands the resulting text to `onResult` — the
 * same text field/parse path used for typed input. No audio is recorded or
 * persisted; only the final transcript text is used, and only if the user
 * goes on to confirm a transaction.
 *
 * Privacy note: recognition is performed by the browser/OS, which on some
 * browsers (e.g. Chrome) sends audio to a cloud speech service rather than
 * processing it on-device. This component makes no on-device-privacy claim
 * — see docs/milestone-6.md, "Voice input limitations".
 */
export function VoiceInputButton({
  onResult,
  language,
  onLanguageChange,
  disabled,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!isSupported) {
    return (
      <p className="text-caption text-muted-foreground">
        Voice input is not supported in this browser.
      </p>
    );
  }

  function handleClick() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setIsSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
          isListening
            ? 'border-danger bg-danger/10 text-danger'
            : 'border-border bg-transparent text-foreground hover:bg-muted',
        )}
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? (
          <motion.span
            animate={reduceMotion ? undefined : { scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <Square size={16} aria-hidden="true" fill="currentColor" />
          </motion.span>
        ) : (
          <Mic size={18} aria-hidden="true" />
        )}
      </button>

      <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span className="sr-only">Voice language</span>
        <select
          className="h-8 rounded-[var(--radius-sm)] border border-border bg-card px-2 text-xs text-foreground disabled:opacity-50"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as VoiceLanguage)}
          disabled={isListening}
          aria-label="Voice language"
        >
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी (Hindi)</option>
        </select>
      </label>

      {isListening ? (
        <span className="text-caption text-danger" role="status" aria-live="polite">
          Listening…
        </span>
      ) : null}
    </div>
  );
}
