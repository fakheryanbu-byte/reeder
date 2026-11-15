import { useRef, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileUp,
  Loader2,
  RefreshCw,
  ScanText,
  Trash2,
} from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import type { DocumentImageSlot } from '../types/guest';

interface DocumentCaptureProps {
  frontImage: DocumentImageSlot | null;
  backImage: DocumentImageSlot | null;
  geminiConsent: boolean;
  isReading: boolean;
  readSucceeded: boolean;
  readError: string | null;
  warnings: string[];
  unreadableFields: string[];
  onSelectImage: (slot: 'front' | 'back', file: File) => void;
  onRemoveImage: (slot: 'front' | 'back') => void;
  onToggleConsent: (checked: boolean) => void;
  onAnalyzeNow: () => void;
  t: TranslationKeys;
}

export function DocumentCapture({
  frontImage,
  backImage,
  geminiConsent,
  isReading,
  readSucceeded,
  readError,
  warnings,
  unreadableFields,
  onSelectImage,
  onRemoveImage,
  onToggleConsent,
  onAnalyzeNow,
  t,
}: DocumentCaptureProps) {
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const frontGalleryRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);
  const backGalleryRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (slot: 'front' | 'back') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onSelectImage(slot, file);
    }
  };

  return (
    <section
      aria-labelledby="doc-section-title"
      className="rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-6"
    >
      <div className="mb-4">
        <h2
          id="doc-section-title"
          className="text-lg font-bold text-[#2C2C2C] sm:text-xl"
        >
          {t.sectionDocTitle}
        </h2>
      </div>

      {/* Consent BEFORE Processing */}
      <label className="mb-4 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-[#2C2C2C]/10 bg-[#F4EFEA] px-3.5 py-2.5">
        <input
          type="checkbox"
          checked={geminiConsent}
          onChange={(e) => onToggleConsent(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[#C58B6D]"
        />
        <span className="text-sm font-semibold text-[#2C2C2C]">
          {t.geminiConsentLabel}
        </span>
      </label>

      {/* Hidden File Inputs */}
      <input
        ref={frontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange('front')}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={frontGalleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange('front')}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={backCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange('back')}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={backGalleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange('back')}
        className="hidden"
        aria-hidden="true"
      />

      {/* Front Side Slot */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#2C2C2C]">{t.frontSideLabel}</span>
        </div>

        {!frontImage ? (
          <div className="space-y-3">
            {/* Reassuring Non-Photographic Suggestion Card (no ID photo shown) */}
            <div className="rounded-2xl border border-[#C58B6D]/30 bg-gradient-to-br from-[#F4EFEA] to-[#FAF7F2] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E8A588]/25 text-[#8C5338]">
                  <ScanText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-bold text-[#2C2C2C]">
                    {t.docPlaceholderTitle}
                  </p>
                </div>
              </div>

              {/* Abstract text-extraction graphic (no ID card or camera imagery) */}
              <div className="mt-3.5 space-y-1.5 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF7F2]/90 p-3" aria-hidden="true">
                <div className="h-2 w-2/3 rounded-full bg-[#C58B6D]/35" />
                <div className="h-2 w-1/2 rounded-full bg-[#2C2C2C]/12" />
                <div className="h-2 w-3/5 rounded-full bg-[#2C2C2C]/10" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => frontCameraRef.current?.click()}
                className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-[#2C2C2C] px-4 py-3 text-sm font-semibold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99]"
              >
                <ScanText className="h-5 w-5 text-[#E8A588]" aria-hidden="true" />
                <span>{t.takePhoto}</span>
              </button>

              <button
                type="button"
                onClick={() => frontGalleryRef.current?.click()}
                className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl border border-[#2C2C2C]/20 bg-[#F4EFEA] px-4 py-3 text-sm font-semibold text-[#2C2C2C] transition-all hover:bg-[#E8A588]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99]"
              >
                <FileUp className="h-5 w-5 text-[#8C5338]" aria-hidden="true" />
                <span>{t.chooseFromGallery}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Privacy-safe card: never display raw ID photo on screen */}
            <div className="flex items-start gap-3 rounded-2xl border border-[#C58B6D]/35 bg-[#F4EFEA] p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8A588]/25 text-[#8C5338]">
                <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold text-[#2C2C2C]">
                  {t.docLoadedHiddenTitle}
                </p>
                <p className="m-0 mt-1 text-xs leading-relaxed text-[#685F58]">
                  {t.docLoadedHiddenDesc}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => frontCameraRef.current?.click()}
                disabled={isReading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>{t.retakePhoto}</span>
              </button>

              <button
                type="button"
                onClick={() => frontGalleryRef.current?.click()}
                disabled={isReading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20 disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                <span>{t.chooseFromGallery}</span>
              </button>

              <button
                type="button"
                onClick={() => onRemoveImage('front')}
                disabled={isReading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#9E3B33] transition-colors hover:bg-[#9E3B33]/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>{t.deletePhoto}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Optional Back Side / Extra Page */}
      {frontImage && (
        <div className="mt-5 border-t border-[#2C2C2C]/10 pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#2C2C2C]">{t.backSideLabel}</span>
          </div>

          {!backImage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => backCameraRef.current?.click()}
                disabled={isReading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed border-[#C58B6D] bg-[#F4EFEA]/70 px-4 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20 disabled:opacity-50"
              >
                <ScanText className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
                <span>{t.addBackSide}</span>
              </button>
              <button
                type="button"
                onClick={() => backGalleryRef.current?.click()}
                disabled={isReading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA]/70 px-4 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20 disabled:opacity-50"
              >
                <FileUp className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
                <span>{t.chooseFromGallery}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-[#C58B6D]/35 bg-[#F4EFEA] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8A588]/25 text-[#8C5338]">
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-xs font-bold text-[#2C2C2C]">
                    {t.docLoadedHiddenTitle}
                  </p>
                  <p className="m-0 mt-0.5 text-xs text-[#685F58]">
                    {t.docLoadedHiddenDesc}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => backCameraRef.current?.click()}
                  disabled={isReading}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>{t.retakePhoto}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveImage('back')}
                  disabled={isReading}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#9E3B33] transition-colors hover:bg-[#9E3B33]/10 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>{t.deletePhoto}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual trigger if file was selected before consent or user wants to re-read */}
      {frontImage && !isReading && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAnalyzeNow}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A588] px-5 py-3 text-sm font-bold text-[#2C2C2C] transition-all hover:bg-[#C58B6D] hover:text-[#FAF7F2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] active:scale-[0.99]"
          >
            <span>{t.analyzeNowButton}</span>
          </button>
        </div>
      )}

      {/* Reading State */}
      {isReading && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-[#C58B6D]/40 bg-[#E8A588]/20 p-3.5 text-sm font-semibold text-[#2C2C2C]"
        >
          <Loader2 className="h-5 w-5 animate-spin text-[#8C5338]" aria-hidden="true" />
          <span>{t.readingDocument}</span>
        </div>
      )}

      {/* Read Success */}
      {!isReading && readSucceeded && !readError && (
        <div
          role="status"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#2E6B47]/25 bg-[#2E6B47]/10 p-3.5 text-sm text-[#2C2C2C]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2E6B47]" aria-hidden="true" />
          <p className="m-0 font-medium">{t.readingComplete}</p>
        </div>
      )}

      {/* Read Error / Fallback */}
      {!isReading && readError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 p-3.5 text-sm text-[#2C2C2C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#9E3B33]" aria-hidden="true" />
          <div>
            <p className="m-0 font-semibold">{readError}</p>
            {readError === t.errServerFailed && (
              <p className="m-0 mt-1 text-xs text-[#685F58]">{t.readingFailedFallback}</p>
            )}
          </div>
        </div>
      )}

      {/* Warnings / Unreadable fields */}
      {!isReading && (warnings.length > 0 || unreadableFields.length > 0) && (
        <div className="mt-4 rounded-2xl border border-[#C58B6D]/40 bg-[#E8A588]/10 p-3.5 text-xs text-[#2C2C2C]">
          <div className="font-bold text-[#8C5338]">{t.warningsTitle}</div>
          {warnings.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 ps-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {unreadableFields.length > 0 && (
            <p className="m-0 mt-2 text-[#685F58]">
              <span className="font-semibold text-[#2C2C2C]">{t.unreadableFieldsLabel} </span>
              {unreadableFields.join(' · ')}
            </p>
          )}
        </div>
      )}

    </section>
  );
}
