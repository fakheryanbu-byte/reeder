import { useEffect, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import {
  DEFAULT_SAUDI_DIAL_CODE,
  normalizeDialCodeInput,
  splitPhoneNumber,
  toAsciiDigits,
} from '../utils/documentRules';

interface PhoneNumberInputProps {
  id?: string;
  value: string;
  onChange: (nextFullValue: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  phoneAriaLabel: string;
  dialCodeLabel: string;
  editLabel: string;
  lockLabel: string;
  hasError?: boolean;
  maxLength?: number;
}

export function PhoneNumberInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  phoneAriaLabel,
  dialCodeLabel,
  editLabel,
  lockLabel,
  hasError = false,
  maxLength = 20,
}: PhoneNumberInputProps) {
  const [isEditingDialCode, setIsEditingDialCode] = useState(false);
  const [dialCodeDraft, setDialCodeDraft] = useState<string>(
    () => splitPhoneNumber(value).dialCode
  );

  const parsed = splitPhoneNumber(value, dialCodeDraft);
  const activeDialCode = isEditingDialCode ? dialCodeDraft : parsed.dialCode;

  // Keep draft synchronized with external resets (e.g. Clear Data button)
  useEffect(() => {
    if (!isEditingDialCode) {
      setDialCodeDraft(splitPhoneNumber(value).dialCode);
    }
  }, [value, isEditingDialCode]);

  const handleLocalChange = (rawInput: string) => {
    const ascii = toAsciiDigits(rawInput).trim();
    if (!ascii) {
      onChange(activeDialCode || DEFAULT_SAUDI_DIAL_CODE);
      return;
    }

    // If user pasted a full international number (e.g. +971501234567 or 00966501234567)
    if (ascii.startsWith('+') || ascii.startsWith('00')) {
      const nextParsed = splitPhoneNumber(ascii);
      setDialCodeDraft(nextParsed.dialCode);
      onChange(`${nextParsed.dialCode}${nextParsed.localNumber}`);
      return;
    }

    const digitsOnly = ascii.replace(/[^\d]/g, '').slice(0, maxLength);
    const baseDial =
      dialCodeDraft && dialCodeDraft !== '+' ? dialCodeDraft : DEFAULT_SAUDI_DIAL_CODE;
    onChange(`${baseDial}${digitsOnly}`);
  };

  const handleDialCodeChange = (rawDial: string) => {
    const normalized = normalizeDialCodeInput(rawDial);
    const nextDraft = normalized || '+';
    setDialCodeDraft(nextDraft);
    const effectiveDial = normalized || DEFAULT_SAUDI_DIAL_CODE;
    onChange(`${effectiveDial}${parsed.localNumber}`);
  };

  const handleFinishEditingDialCode = () => {
    const cleaned =
      dialCodeDraft && dialCodeDraft !== '+' ? dialCodeDraft : DEFAULT_SAUDI_DIAL_CODE;
    setDialCodeDraft(cleaned);
    setIsEditingDialCode(false);
    onChange(`${cleaned}${parsed.localNumber}`);
  };

  return (
    <div
      dir="ltr"
      className={`flex items-stretch overflow-hidden rounded-xl border transition-colors ${
        hasError
          ? 'border-[#C58B6D] bg-[#E8A588]/15 focus-within:ring-2 focus-within:ring-[#C58B6D]'
          : 'border-[#2C2C2C]/15 bg-[#FFFFFF] focus-within:ring-2 focus-within:ring-[#C58B6D]'
      }`}
    >
      {/* Country Code Segment (locked by default to prevent accidental edits) */}
      <div
        className="flex shrink-0 items-center gap-1.5 bg-[#F4EFEA] px-2.5 py-1.5"
        onBlur={(e) => {
          if (
            isEditingDialCode &&
            !e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            handleFinishEditingDialCode();
          }
        }}
      >
        {isEditingDialCode ? (
          <>
            <input
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoFocus
              aria-label={dialCodeLabel}
              value={dialCodeDraft}
              onChange={(e) => handleDialCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFinishEditingDialCode();
                }
              }}
              maxLength={5}
              className="ltr-field tabular-nums min-h-[34px] w-[62px] rounded-lg border border-[#C58B6D] bg-[#FFFFFF] px-1.5 text-center text-sm font-bold text-[#2C2C2C] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleFinishEditingDialCode}
              aria-label={lockLabel}
              title={lockLabel}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#2C2C2C] px-2 py-1 text-[11px] font-semibold text-[#FAF7F2] hover:bg-[#2C2C2C]/90"
            >
              <Check className="h-3 w-3 text-[#E8A588]" aria-hidden="true" />
              <span>{lockLabel}</span>
            </button>
          </>
        ) : (
          <>
            <span
              className="ltr-field tabular-nums select-none px-1 text-sm font-bold text-[#2C2C2C]"
              aria-label={`${dialCodeLabel}: ${activeDialCode}`}
            >
              {activeDialCode}
            </span>
            <button
              type="button"
              onClick={() => {
                setDialCodeDraft(activeDialCode || DEFAULT_SAUDI_DIAL_CODE);
                setIsEditingDialCode(true);
              }}
              aria-label={`${editLabel} ${dialCodeLabel}`}
              title={`${editLabel} ${dialCodeLabel}`}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#2C2C2C]/10 bg-[#FFFFFF]/80 px-2 py-1 text-[11px] font-semibold text-[#8C5338] transition-colors hover:bg-[#E8A588]/20"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              <span>{editLabel}</span>
            </button>
          </>
        )}
      </div>

      {/* Clear Vertical Separator between Country Code and Phone Number */}
      <div className="w-px self-stretch bg-[#2C2C2C]/20" aria-hidden="true" />

      {/* Local Phone Number Input */}
      <input
        id={id}
        type="tel"
        dir="ltr"
        inputMode="tel"
        aria-label={phoneAriaLabel}
        value={parsed.localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className="ltr-field tabular-nums min-h-[48px] min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-[#2C2C2C] placeholder:text-[#685F58]/60 focus:outline-none"
      />
    </div>
  );
}
