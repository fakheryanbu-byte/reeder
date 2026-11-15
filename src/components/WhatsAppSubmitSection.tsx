import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import { DEFAULT_HOTEL_TERMS_AR, DEFAULT_HOTEL_TERMS_EN } from '../services/hotels';
import type { HotelRecord, Language, ValidationResult } from '../types/guest';

interface WhatsAppSubmitSectionProps {
  validation: ValidationResult;
  declarationAccepted: boolean;
  onToggleDeclaration: (checked: boolean) => void;
  hotelTermsAccepted?: boolean;
  onToggleHotelTerms?: (checked: boolean) => void;
  onPrepareAndOpenWhatsApp: () => void;
  preparedMessage: string | null;
  preparedUrl: string | null;
  attemptedSubmit: boolean;
  targetHotel?: HotelRecord | null;
  isSubmittingToHotel?: boolean;
  submitError?: string | null;
  onSubmitToHotel?: () => void;
  lang?: Language;
  t: TranslationKeys;
}

export function WhatsAppSubmitSection({
  validation,
  declarationAccepted,
  onToggleDeclaration,
  hotelTermsAccepted = false,
  onToggleHotelTerms,
  onPrepareAndOpenWhatsApp,
  preparedMessage,
  preparedUrl,
  attemptedSubmit,
  targetHotel,
  isSubmittingToHotel = false,
  submitError = null,
  onSubmitToHotel,
  lang = 'ar',
  t,
}: WhatsAppSubmitSectionProps) {
  const [copied, setCopied] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const isHotelMode = Boolean(targetHotel);
  const resolvedHotelTerms =
    targetHotel?.termsText?.trim() ||
    (lang === 'en' ? DEFAULT_HOTEL_TERMS_EN : DEFAULT_HOTEL_TERMS_AR);

  const handleCopyMessage = async () => {
    if (!preparedMessage) return;
    try {
      await navigator.clipboard.writeText(preparedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard fallback ignored gracefully
    }
  };

  const fieldNameMap: Record<string, string> = {
    fullName: t.fieldFullName,
    documentType: t.fieldDocumentType,
    documentNumber: t.fieldDocumentNumber,
    nationality: t.fieldNationality,
    dateOfBirth: t.fieldDateOfBirth,
    birthCalendar: t.fieldCalendar,
    versionNumber: t.fieldVersionNumber,
    borderNumber: t.fieldBorderNumber,
    mobileNumber: t.fieldMobileNumber,
    purposeOfVisit: t.fieldPurposeOfVisit,
    otherPurposeDetail: t.fieldOtherPurpose,
    bookingSource: t.fieldBookingSource,
    accompanyingMemberBirthDates: t.familyMemberDobRequired,
    accompanyingMemberNames: t.familyMemberNameRequired,
    declaration: t.declarationText,
    hotelTerms: t.guestHotelTermsRequired,
  };

  return (
    <section
      aria-labelledby="send-section-title"
      className="rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-6"
    >
      <div className="mb-4">
        <h2
          id="send-section-title"
          className="text-lg font-bold text-[#2C2C2C] sm:text-xl"
        >
          {isHotelMode ? t.sectionSendHotelTitle : t.sectionSendTitle}
        </h2>
        <p className="mt-1 text-sm text-[#685F58]">
          {isHotelMode ? t.hotelPrivacyNotice : t.whatsappPrivacyNotice}
        </p>
      </div>

      {/* Incomplete border number notice */}
      {!validation.isDataComplete && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#C58B6D]/50 bg-[#E8A588]/15 p-3.5 text-xs font-medium text-[#2C2C2C] sm:text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8C5338]" aria-hidden="true" />
          <p className="m-0">{t.incompleteBorderNotice}</p>
        </div>
      )}

      {/* Declaration Checkbox */}
      <label
        className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
          attemptedSubmit && !declarationAccepted
            ? 'border-[#C58B6D] bg-[#E8A588]/15'
            : 'border-[#2C2C2C]/10 bg-[#F4EFEA]/80'
        }`}
      >
        <input
          type="checkbox"
          checked={declarationAccepted}
          onChange={(e) => onToggleDeclaration(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C58B6D]"
        />
        <span className="text-sm font-medium leading-relaxed text-[#2C2C2C]">
          {t.declarationText}
        </span>
      </label>

      {/* Facility/Hotel Terms & Policies Reader + Agreement Checkbox */}
      <div className="mt-4 space-y-2.5 rounded-2xl border border-[#2C2C2C]/12 bg-[#F4EFEA]/60 p-3.5 sm:p-4">
        <button
          type="button"
          onClick={() => setTermsOpen((prev) => !prev)}
          aria-expanded={termsOpen}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-4 py-2.5 text-start text-sm font-bold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/15"
        >
          <span className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 shrink-0 text-[#8C5338]" aria-hidden="true" />
            <span>
              {termsOpen ? t.guestHideTermsButton : t.guestReadTermsButton}
              {!termsOpen && targetHotel?.name && (
                <span className="ms-1.5 font-medium text-[#685F58]">
                  ({targetHotel.name})
                </span>
              )}
            </span>
          </span>
          {termsOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#8C5338]" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#8C5338]" aria-hidden="true" />
          )}
        </button>

        {termsOpen && (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-[#2C2C2C]/10 bg-[#FFFFFF] p-4">
            <p className="mb-2 text-xs font-bold text-[#8C5338]">
              {t.guestHotelTermsTitle}
              {targetHotel?.name ? ` — ${targetHotel.name}` : ''}
            </p>
            <div className="whitespace-pre-line text-sm leading-relaxed text-[#2C2C2C]">
              {resolvedHotelTerms}
            </div>
          </div>
        )}

        <label
          className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
            attemptedSubmit && !hotelTermsAccepted
              ? 'border-[#C58B6D] bg-[#E8A588]/15'
              : 'border-[#2C2C2C]/10 bg-[#FAF7F2]'
          }`}
        >
          <input
            type="checkbox"
            checked={hotelTermsAccepted}
            onChange={(e) => onToggleHotelTerms?.(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#C58B6D]"
          />
          <span className="text-sm font-medium leading-relaxed text-[#2C2C2C]">
            {t.guestHotelTermsCheckbox}
          </span>
        </label>
      </div>

      {/* Validation summary when user attempted to submit with missing items */}
      {attemptedSubmit && !validation.canOpenWhatsApp && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 p-3.5 text-xs text-[#2C2C2C] sm:text-sm"
        >
          <p className="m-0 font-bold text-[#9E3B33]">{t.validationMissingHeader}</p>
          <ul className="mt-1.5 list-disc space-y-1 ps-5">
            {validation.missingRequiredFields.map((fieldKey) => (
              <li key={fieldKey}>{fieldNameMap[fieldKey] ?? fieldKey}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 p-3.5 text-xs font-medium text-[#9E3B33] sm:text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="m-0">{submitError}</p>
        </div>
      )}

      {/* Send CTA */}
      <div className="mt-5 space-y-3">
        {isHotelMode ? (
          <button
            type="button"
            disabled={isSubmittingToHotel}
            onClick={onSubmitToHotel}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2C2C2C] px-6 py-3.5 text-base font-bold text-[#FAF7F2] shadow-sm transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmittingToHotel ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#E8A588]" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5 text-[#E8A588]" aria-hidden="true" />
            )}
            <span>
              {isSubmittingToHotel ? t.sendingToHotelButton : t.sendToHotelButton}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrepareAndOpenWhatsApp}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#2C2C2C] px-6 py-3.5 text-base font-bold text-[#FAF7F2] shadow-sm transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99]"
          >
            <MessageCircle className="h-5 w-5 text-[#E8A588]" aria-hidden="true" />
            <span>{t.sendToWhatsAppButton}</span>
          </button>
        )}

        <p className="m-0 text-xs leading-relaxed text-[#685F58] sm:text-sm">
          {t.photoAttachInstruction}
        </p>
      </div>

      {/* Post-prepare Confirmation & Fallback (General WhatsApp mode) */}
      {!isHotelMode && preparedMessage && preparedUrl && (
        <div
          role="status"
          className="mt-5 space-y-3 rounded-2xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 p-4"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2E6B47]" aria-hidden="true" />
            <p className="m-0 text-sm font-bold text-[#2C2C2C]">
              {t.messageReadySuccess}
            </p>
          </div>

          <div className="border-t border-[#2C2C2C]/10 pt-3">
            <p className="m-0 text-xs font-semibold text-[#685F58]">{t.fallbackTitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={preparedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2C2C2C] px-3.5 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-[#2C2C2C]/90"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#E8A588]" aria-hidden="true" />
                <span>{t.sendToWhatsAppButton}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/20 bg-[#FAF7F2] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#2E6B47]" aria-hidden="true" />
                    <span>{t.copiedMessage}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.copyMessageButton}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
