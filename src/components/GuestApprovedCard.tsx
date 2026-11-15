import { useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  MessageSquareQuote,
  RotateCcw,
} from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import type {
  CheckinSessionRecord,
  GuestFormData,
  HotelRecord,
  Language,
} from '../types/guest';
import {
  buildWhatsAppMessage,
  checkinSessionToGuestForm,
} from '../utils/documentRules';

interface GuestApprovedCardProps {
  session: CheckinSessionRecord;
  hotel: HotelRecord | null;
  form: GuestFormData;
  lang: Language;
  t: TranslationKeys;
  onStartNewCheckin: () => void;
}

export function GuestApprovedCard({
  session,
  hotel,
  form,
  lang,
  t,
  onStartNewCheckin,
}: GuestApprovedCardProps) {
  const [copied, setCopied] = useState(false);

  const hotelName = hotel?.name || session.hotelName || '';
  const guestName = session.guestName || form.fullName.trim();
  const roomNumber = session.roomNumber ?? '';

  const effectiveForm = form.fullName.trim()
    ? form
    : checkinSessionToGuestForm(session);

  const summaryText = buildWhatsAppMessage(
    effectiveForm,
    [],
    roomNumber,
    hotelName
  );

  const welcomeMessage =
    session.welcomeMessage?.trim() ||
    (lang === 'ar'
      ? `مرحباً بك في ${hotelName}، ${guestName}! تم تأكيد حجزك وتخصيص غرفة رقم ${roomNumber} لك. نتمنى لك إقامة سعيدة!`
      : `Welcome to ${hotelName}, ${guestName}! Your booking is confirmed and you have been assigned Room ${roomNumber}. Have a great stay!`);

  const handleCopyRecord = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard fallback ignored gracefully
    }
  };

  return (
    <section
      aria-live="polite"
      className="mx-auto max-w-xl rounded-3xl border border-[#2E6B47]/30 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-10"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2E6B47]/25 bg-[#2E6B47]/10 text-[#2E6B47]">
        <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
      </div>

      <p className="m-0 text-xs font-semibold tracking-wide text-[#2E6B47] sm:text-sm">
        {t.approvedTitle}
      </p>

      {hotelName && (
        <div className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[#685F58]">
          <Building2 className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
          <span>{hotelName}</span>
        </div>
      )}

      {/* Prominent Assigned Room Display */}
      <div className="mx-auto mt-5 max-w-xs rounded-2xl border border-[#2E6B47]/25 bg-[#2E6B47]/8 px-6 py-4">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#685F58]">
          <KeyRound className="h-4 w-4 text-[#2E6B47]" aria-hidden="true" />
          <span>{t.approvedRoomLabel}</span>
        </div>
        <div className="ltr-field tabular-nums mt-1 text-4xl font-bold tracking-tight text-[#2C2C2C]">
          {roomNumber}
        </div>
      </div>

      {/* Custom Welcome Message from Reception */}
      <div className="mt-5 rounded-2xl border border-[#2C2C2C]/10 bg-[#F4EFEA] p-4 text-start sm:p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8C5338]">
          <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
          <span>{t.approvedWelcomeLabel}</span>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm font-bold leading-relaxed text-[#2C2C2C] sm:text-base">
          {welcomeMessage}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={handleCopyRecord}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-4 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-[#2E6B47]" aria-hidden="true" />
              <span>{t.copiedMessage}</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>{t.copyMessageButton}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onStartNewCheckin}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#2C2C2C] px-5 py-2 text-xs font-bold text-[#FAF7F2] transition-colors hover:bg-[#2C2C2C]/90"
        >
          <RotateCcw className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
          <span>{t.startNewCheckin}</span>
        </button>
      </div>
    </section>
  );
}
