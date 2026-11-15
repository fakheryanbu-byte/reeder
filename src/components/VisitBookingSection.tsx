import { AlertCircle } from 'lucide-react';
import { BOOKING_SOURCES, DEFAULT_VISIT_PURPOSES } from '../config/visitOptions';
import type { TranslationKeys } from '../i18n/ar';
import type { BookingSourceId, GuestFormData, VisitPurposeId } from '../types/guest';

interface VisitBookingSectionProps {
  form: GuestFormData;
  missingFields: Set<string>;
  onSelectPurpose: (purpose: VisitPurposeId) => void;
  onChangeOtherPurpose: (detail: string) => void;
  onSelectBookingSource: (source: BookingSourceId) => void;
  onChangeBookingReference: (ref: string) => void;
  t: TranslationKeys;
}

export function VisitBookingSection({
  form,
  missingFields,
  onSelectPurpose,
  onChangeOtherPurpose,
  onSelectBookingSource,
  onChangeBookingReference,
  t,
}: VisitBookingSectionProps) {
  const enabledPurposes = DEFAULT_VISIT_PURPOSES.filter((p) => p.enabled);

  return (
    <section
      aria-labelledby="visit-section-title"
      className="rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-6"
    >
      <div className="mb-4">
        <h2
          id="visit-section-title"
          className="text-lg font-bold text-[#2C2C2C] sm:text-xl"
        >
          {t.sectionVisitTitle}
        </h2>
      </div>

      {/* Purpose of Visit */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#2C2C2C]">
            {t.fieldPurposeOfVisit}
            <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
          </span>
          {missingFields.has('purposeOfVisit') && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C5338]">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.missingBadge}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {enabledPurposes.map((item) => {
            const isSelected = form.purposeOfVisit === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectPurpose(item.id)}
                className={`min-h-[48px] rounded-2xl border px-3 py-2.5 text-center text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99] sm:text-sm ${
                  isSelected
                    ? 'border-[#C58B6D] bg-[#E8A588]/30 text-[#2C2C2C] shadow-sm'
                    : 'border-[#2C2C2C]/10 bg-[#F4EFEA]/70 text-[#2C2C2C] hover:border-[#C58B6D]/60 hover:bg-[#F4EFEA]'
                }`}
              >
                {t.purposes[item.id]}
              </button>
            );
          })}
        </div>

        {form.purposeOfVisit === 'other' && (
          <div className="pt-1">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#2C2C2C]">
                {t.fieldOtherPurpose}
                <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
              </label>
              {missingFields.has('otherPurposeDetail') && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C5338]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.missingBadge}</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={form.otherPurposeDetail}
              onChange={(e) => onChangeOtherPurpose(e.target.value)}
              placeholder={t.fieldOtherPurposePlaceholder}
              className={`min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D] ${
                missingFields.has('otherPurposeDetail')
                  ? 'border-[#C58B6D] bg-[#E8A588]/15'
                  : 'border-[#2C2C2C]/15 bg-[#FFFFFF]'
              }`}
            />
          </div>
        )}

        <p className="m-0 text-xs text-[#685F58]">{t.purposeSettingsNote}</p>
      </div>

      {/* Booking Source */}
      <div className="mt-6 space-y-3 border-t border-[#2C2C2C]/10 pt-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#2C2C2C]">
            {t.fieldBookingSource}
            <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
          </span>
          {missingFields.has('bookingSource') && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C5338]">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.missingBadge}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {BOOKING_SOURCES.map((source) => {
            const isSelected = form.bookingSource === source;
            return (
              <button
                key={source}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectBookingSource(source)}
                className={`min-h-[48px] rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#C58B6D] bg-[#E8A588]/30 text-[#2C2C2C] shadow-sm'
                    : 'border-[#2C2C2C]/10 bg-[#F4EFEA]/70 text-[#2C2C2C] hover:border-[#C58B6D]/60 hover:bg-[#F4EFEA]'
                }`}
              >
                {t.bookingSources[source]}
              </button>
            );
          })}
        </div>

        {form.bookingSource === 'booking_com' && (
          <div className="pt-1">
            <label className="mb-1.5 block text-xs font-semibold text-[#2C2C2C]">
              {t.fieldBookingReference}
            </label>
            <input
              type="text"
              dir="ltr"
              value={form.bookingReference}
              onChange={(e) => onChangeBookingReference(e.target.value)}
              placeholder={t.fieldBookingReferencePlaceholder}
              className="ltr-field tabular-nums min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
            />
          </div>
        )}
      </div>
    </section>
  );
}
