import { Building2, Clock, Loader2, RotateCcw, User, XCircle } from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import type { CheckinSessionRecord, HotelRecord } from '../types/guest';

interface GuestWaitingCardProps {
  session: CheckinSessionRecord | null;
  sessionId: string;
  hotel: HotelRecord | null;
  guestName: string;
  t: TranslationKeys;
  onCancel: () => void;
}

export function GuestWaitingCard({
  session,
  sessionId,
  hotel,
  guestName,
  t,
  onCancel,
}: GuestWaitingCardProps) {
  const hotelName = hotel?.name || session?.hotelName || '';
  const resolvedGuestName = session?.guestName || guestName;
  const isCancelled = session?.status === 'cancelled';

  return (
    <section
      aria-live="polite"
      className={`mx-auto max-w-xl rounded-3xl border bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-10 ${
        isCancelled ? 'border-[#9E3B33]/30' : 'border-[#2C2C2C]/10'
      }`}
    >
      <div
        className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${
          isCancelled
            ? 'border-[#9E3B33]/25 bg-[#9E3B33]/10 text-[#9E3B33]'
            : 'border-[#C58B6D]/30 bg-[#E8A588]/20 text-[#8C5338]'
        }`}
      >
        {isCancelled ? (
          <XCircle className="h-8 w-8" aria-hidden="true" />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        )}
      </div>

      <h2 className="text-balance text-xl font-bold leading-snug text-[#2C2C2C] sm:text-2xl">
        {isCancelled ? t.guestCancelledTitle : t.waitingTitle}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#685F58] sm:text-base">
        {isCancelled ? t.guestCancelledDesc : t.waitingSubtitle}
      </p>

      <div className="mt-7 divide-y divide-[#2C2C2C]/10 rounded-2xl border border-[#2C2C2C]/10 bg-[#F4EFEA]/70 text-start">
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-[#685F58]">
            <Building2 className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
            <span>{t.waitingBranchLabel}</span>
          </span>
          <span className="font-bold text-[#2C2C2C]">{hotelName}</span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-[#685F58]">
            <User className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
            <span>{t.waitingGuestLabel}</span>
          </span>
          <span className="font-bold text-[#2C2C2C]">{resolvedGuestName}</span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-[#685F58]">
            <Clock className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
            <span>{t.waitingSessionIdLabel}</span>
          </span>
          <span className="ltr-field tabular-nums font-mono text-xs text-[#2C2C2C]">
            {sessionId.slice(0, 12)}
          </span>
        </div>
      </div>

      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] ${
            isCancelled
              ? 'bg-[#2C2C2C] px-5 font-bold text-[#FAF7F2] hover:bg-[#2C2C2C]/90'
              : 'border border-[#2C2C2C]/15 bg-[#FAF7F2] text-[#685F58] hover:bg-[#E8A588]/20 hover:text-[#2C2C2C]'
          }`}
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isCancelled ? 'text-[#E8A588]' : ''}`} aria-hidden="true" />
          <span>{isCancelled ? t.guestCancelledStartNew : t.cancelAndStartOver}</span>
        </button>
      </div>
    </section>
  );
}
