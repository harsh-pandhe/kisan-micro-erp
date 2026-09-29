import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { UiButton } from './ui/button';
import { UiTextarea } from './ui/textarea';
import { VoiceInputButton, type VoiceLanguage } from './VoiceInputButton';

interface TransactionInputProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  voiceLanguage: VoiceLanguage;
  onVoiceLanguageChange: (language: VoiceLanguage) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  'Paid ₹500 cash for fertilizer',
  'Sold wheat for ₹5,000',
  'Received ₹2,000 from Ramesh',
];

/**
 * Text entry for a transaction, shared by typed and voice input — a voice
 * transcript is written into the same textarea and goes through the exact
 * same "Review transaction" action (calling `parseTransactionText()`),
 * never a separate voice-only code path.
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
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <label htmlFor="transaction-composer" className="text-label text-foreground">
        Describe the transaction
      </label>
      <UiTextarea
        id="transaction-composer"
        aria-describedby={inputId}
        className="min-h-28 resize-none text-base leading-relaxed sm:min-h-32"
        rows={4}
        value={value}
        placeholder="e.g. Paid ₹500 cash for fertilizer"
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <p id={inputId} className="text-caption text-muted-foreground">
        Example: "Sold wheat for ₹5,000" or "Received ₹2,000 from Ramesh".
      </p>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <UiButton
            key={example}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-left text-xs font-medium"
            onClick={() => onChange(example)}
            disabled={disabled}
          >
            {example}
          </UiButton>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <UiButton
          type="button"
          size="lg"
          onClick={onParse}
          disabled={disabled || value.trim().length === 0}
        >
          Review transaction
        </UiButton>
        <VoiceInputButton
          onResult={(text) => onChange(text)}
          language={voiceLanguage}
          onLanguageChange={onVoiceLanguageChange}
          disabled={disabled}
        />
      </div>
    </motion.div>
  );
}
