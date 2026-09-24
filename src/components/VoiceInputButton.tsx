import { useEffect, useRef, useState } from 'react';
import './VoiceInputButton.css';

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!isSupported) {
    return (
      <p className="voice-input__unsupported">Voice input is not supported in this browser.</p>
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
    <div className="voice-input">
      <button
        type="button"
        className={`voice-input__mic ${isListening ? 'voice-input__mic--active' : ''}`}
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? '■' : '🎤'}
      </button>
      <label className="voice-input__lang">
        <span className="voice-input__lang-label">Voice language</span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as VoiceLanguage)}
          disabled={isListening}
        >
          <option value="en-IN">English</option>
          <option value="hi-IN">हिन्दी (Hindi)</option>
        </select>
      </label>
      {isListening ? (
        <span className="voice-input__status" role="status" aria-live="polite">
          Listening…
        </span>
      ) : null}
    </div>
  );
}
