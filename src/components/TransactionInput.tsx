import { useId } from 'react';
import { Button } from './Button';
import { VoiceInputButton, type VoiceLanguage } from './VoiceInputButton';

interface TransactionInputProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  voiceLanguage: VoiceLanguage;
  onVoiceLanguageChange: (language: VoiceLanguage) => void;
  disabled?: boolean;
}

/**
 * Text entry for a transaction, shared by typed and voice input — a voice
 * transcript is written into the same textarea and goes through the exact
 * same "Parse" action, never a separate voice-only code path.
 */
export function TransactionInput({
  value,
  onChange,
  onParse,
  voiceLanguage,
  onVoiceLanguageChange,
  disabled,
}: TransactionInputProps) {
  const inputId = useId();

  return (
    <div className="transaction-input">
      <label htmlFor={inputId} className="field__label">
        Describe the transaction
      </label>
      <textarea
        id={inputId}
        className="field__input transaction-input__textarea"
        rows={3}
        value={value}
        placeholder='e.g. "Paid 500 cash for fertilizer"'
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="transaction-input__actions">
        <Button type="button" onClick={onParse} disabled={disabled || value.trim().length === 0}>
          Parse
        </Button>
        <VoiceInputButton
          onResult={(text) => onChange(text)}
          language={voiceLanguage}
          onLanguageChange={onVoiceLanguageChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
