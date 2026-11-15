import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, Loader2 } from 'lucide-react';
import { AdminAuthGate } from './components/AdminAuthGate';
import { DocumentCapture } from './components/DocumentCapture';
import { GuestApprovedCard } from './components/GuestApprovedCard';
import { GuestDataForm } from './components/GuestDataForm';
import { GuestWaitingCard } from './components/GuestWaitingCard';
import { HeaderBar } from './components/HeaderBar';
import { HotelPortal } from './components/HotelPortal';
import { OwnerDashboard } from './components/OwnerDashboard';
import { VisitBookingSection } from './components/VisitBookingSection';
import { WhatsAppSubmitSection } from './components/WhatsAppSubmitSection';
import { getTranslations } from './i18n';
import {
  createCheckinSession,
  subscribeToCheckinSession,
} from './services/checkinSessions';
import { subscribeToHotelById } from './services/hotels';
import type {
  AppViewMode,
  BookingSourceId,
  CheckinSessionRecord,
  DocumentImageSlot,
  DocumentType,
  ExtractedDocumentData,
  FamilyMember,
  GuestFormData,
  HotelRecord,
  Language,
  LockedFormFields,
  VisitPurposeId,
} from './types/guest';
import {
  applyExtractedDataToForm,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  createEmptyGuestForm,
  createEmptyLockedFields,
  deriveLockedFieldsFromExtraction,
  isHotelOperational,
  isMemberUnder18,
  selectPrimaryFamilyMember,
  switchDocumentType,
  validateGuestRequest,
} from './utils/documentRules';
import {
  isSupportedImageFile,
  MAX_IMAGE_BYTES,
  prepareImageForUpload,
} from './utils/imageUtils';

function readUrlState(): { viewMode: AppViewMode; qrHotelId: string | null } {
  if (typeof window === 'undefined') {
    return { viewMode: 'guest', qrHotelId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const hotelParam = params.get('hotel')?.trim() || null;
  if (hotelParam) {
    return { viewMode: 'guest', qrHotelId: hotelParam };
  }
  const viewParam = params.get('view');
  if (viewParam === 'hotel' || viewParam === 'owner') {
    return { viewMode: viewParam, qrHotelId: null };
  }
  return { viewMode: 'guest', qrHotelId: null };
}

function getSessionStorageKey(hotelId: string): string {
  return `checkin_session_${hotelId}`;
}

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const t = getTranslations(lang);

  const initialUrlState = readUrlState();
  const [viewMode, setViewMode] = useState<AppViewMode>(initialUrlState.viewMode);
  const [qrHotelId, setQrHotelId] = useState<string | null>(initialUrlState.qrHotelId);

  // Hotel QR mode state
  const [qrHotel, setQrHotel] = useState<HotelRecord | null>(null);
  const [loadingQrHotel, setLoadingQrHotel] = useState(Boolean(initialUrlState.qrHotelId));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (!initialUrlState.qrHotelId || typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(getSessionStorageKey(initialUrlState.qrHotelId));
    } catch {
      return null;
    }
  });
  const [activeSession, setActiveSession] = useState<CheckinSessionRecord | null>(null);
  const [isSubmittingToHotel, setIsSubmittingToHotel] = useState(false);
  const [submitHotelError, setSubmitHotelError] = useState<string | null>(null);

  const [frontImage, setFrontImage] = useState<DocumentImageSlot | null>(null);
  const [backImage, setBackImage] = useState<DocumentImageSlot | null>(null);
  const [geminiConsent, setGeminiConsent] = useState(false);

  const [isReading, setIsReading] = useState(false);
  const [readSucceeded, setReadSucceeded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unreadableFields, setUnreadableFields] = useState<string[]>([]);

  const [form, setForm] = useState<GuestFormData>(createEmptyGuestForm);
  const [lockedFields, setLockedFields] = useState<LockedFormFields>(createEmptyLockedFields);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [hotelTermsAccepted, setHotelTermsAccepted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [preparedMessage, setPreparedMessage] = useState<string | null>(null);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [clearedBanner, setClearedBanner] = useState(false);

  const frontUrlRef = useRef<string | null>(null);
  const backUrlRef = useRef<string | null>(null);

  // Sync HTML lang and dir on language switch without losing any session state
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const next = readUrlState();
      setQrHotelId(next.qrHotelId);
      setViewMode(next.viewMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Subscribe to target hotel document when ?hotel=<hotelId> is present
  useEffect(() => {
    setHotelTermsAccepted(false);
    if (!qrHotelId) {
      setQrHotel(null);
      setLoadingQrHotel(false);
      setActiveSessionId(null);
      setActiveSession(null);
      return;
    }

    setLoadingQrHotel(true);
    try {
      const restoredId = window.sessionStorage.getItem(getSessionStorageKey(qrHotelId));
      setActiveSessionId(restoredId);
    } catch {
      setActiveSessionId(null);
    }

    const unsub = subscribeToHotelById(
      qrHotelId,
      (hotelDoc) => {
        setQrHotel(hotelDoc);
        setLoadingQrHotel(false);
      },
      () => {
        setQrHotel(null);
        setLoadingQrHotel(false);
      }
    );
    return () => unsub();
  }, [qrHotelId]);

  // Subscribe to active check-in session for live waiting -> approved transition
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }
    const unsub = subscribeToCheckinSession(
      activeSessionId,
      (sessionDoc) => {
        setActiveSession(sessionDoc);
      },
      () => {
        // Keep UI graceful if listener errors
      }
    );
    return () => unsub();
  }, [activeSessionId]);

  // Revoke preview ObjectURLs on unmount
  useEffect(() => {
    return () => {
      if (frontUrlRef.current) URL.revokeObjectURL(frontUrlRef.current);
      if (backUrlRef.current) URL.revokeObjectURL(backUrlRef.current);
    };
  }, []);

  const navigateTo = (nextView: AppViewMode, nextHotelId: string | null = null) => {
    setQrHotelId(nextHotelId);
    setViewMode(nextView);

    const url = new URL(window.location.href);
    url.searchParams.delete('hotel');
    url.searchParams.delete('view');
    if (nextHotelId) {
      url.searchParams.set('hotel', nextHotelId);
    } else if (nextView !== 'guest') {
      url.searchParams.set('view', nextView);
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
  };

  const validation = useMemo(
    () => validateGuestRequest(form, declarationAccepted, true, hotelTermsAccepted),
    [form, declarationAccepted, hotelTermsAccepted]
  );

  const missingFieldsSet = useMemo(() => {
    // Highlight missing required document fields right away once form has been populated or submitted
    if (readSucceeded || attemptedSubmit || form.documentType !== 'unknown') {
      return new Set<string>(validation.missingRequiredFields);
    }
    return new Set<string>();
  }, [readSucceeded, attemptedSubmit, form.documentType, validation.missingRequiredFields]);

  const purgeImages = () => {
    if (frontUrlRef.current) URL.revokeObjectURL(frontUrlRef.current);
    if (backUrlRef.current) URL.revokeObjectURL(backUrlRef.current);
    frontUrlRef.current = null;
    backUrlRef.current = null;
    setFrontImage(null);
    setBackImage(null);
  };

  const runAnalysis = async (
    front: DocumentImageSlot | null,
    back: DocumentImageSlot | null,
    mergeWithExisting = false
  ) => {
    if (!front) return;
    setIsReading(true);
    setReadError(null);
    setClearedBanner(false);

    const images = [{ mimeType: front.mimeType, base64: front.base64 }];
    if (back) {
      images.push({ mimeType: back.mimeType, base64: back.base64 });
    }

    try {
      const response = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (response.status === 413) {
        setReadError(t.errFileTooLarge);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setReadError(t.errServerFailed);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | { data?: ExtractedDocumentData; code?: string }
        | null;

      if (!response.ok || !payload || !payload.data || typeof payload.data !== 'object') {
        if (payload?.code === 'FILE_TOO_LARGE') {
          setReadError(t.errFileTooLarge);
        } else if (payload?.code === 'GEMINI_QUOTA_EXCEEDED') {
          setReadError(t.errGeminiQuotaExceeded);
        } else if (response.status === 429 || payload?.code === 'RATE_LIMITED') {
          setReadError(t.errRateLimited);
        } else if (payload?.code === 'GEMINI_NOT_CONFIGURED') {
          setReadError(t.errGeminiNotConfigured);
        } else if (payload?.code === 'GEMINI_AUTH_ERROR') {
          setReadError(t.errGeminiAuth);
        } else {
          setReadError(t.errServerFailed);
        }
        return;
      }

      const extracted = payload.data;
      setForm((prev) => {
        const nextForm = applyExtractedDataToForm(prev, extracted, mergeWithExisting);
        setLockedFields((prevLocks) =>
          deriveLockedFieldsFromExtraction(prevLocks, prev, nextForm, extracted, mergeWithExisting)
        );
        return nextForm;
      });
      setWarnings(Array.isArray(extracted.warnings) ? extracted.warnings : []);
      setUnreadableFields(
        Array.isArray(extracted.unreadableFields) ? extracted.unreadableFields : []
      );
      setReadSucceeded(true);
      // Do not retain any copy of the document photo after reading the data
      purgeImages();
    } catch {
      setReadError(t.errServerFailed);
    } finally {
      setIsReading(false);
    }
  };

  const handleSelectImage = async (slot: 'front' | 'back', file: File) => {
    setReadError(null);
    setClearedBanner(false);

    if (!isSupportedImageFile(file)) {
      setReadError(t.errInvalidFileType);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setReadError(t.errFileTooLarge);
      return;
    }

    const prepared = await prepareImageForUpload(file);

    const nextSlot: DocumentImageSlot = {
      id: slot,
      file,
      previewUrl: '',
      base64: prepared.base64,
      mimeType: prepared.mimeType,
    };

    if (slot === 'front') {
      if (frontUrlRef.current) URL.revokeObjectURL(frontUrlRef.current);
      frontUrlRef.current = null;
      setFrontImage(nextSlot);
      if (geminiConsent) {
        await runAnalysis(nextSlot, backImage, readSucceeded);
      }
    } else {
      if (backUrlRef.current) URL.revokeObjectURL(backUrlRef.current);
      backUrlRef.current = null;
      setBackImage(nextSlot);
      if (geminiConsent && frontImage) {
        await runAnalysis(frontImage, nextSlot, readSucceeded);
      }
    }
  };

  const handleRemoveImage = (slot: 'front' | 'back') => {
    if (slot === 'front') {
      purgeImages();
      setReadSucceeded(false);
      setReadError(null);
      setWarnings([]);
      setUnreadableFields([]);
      setLockedFields(createEmptyLockedFields());
    } else {
      if (backUrlRef.current) URL.revokeObjectURL(backUrlRef.current);
      backUrlRef.current = null;
      setBackImage(null);
    }
  };

  const handleToggleConsent = (checked: boolean) => {
    setGeminiConsent(checked);
    if (checked && frontImage && !isReading) {
      void runAnalysis(frontImage, backImage, readSucceeded);
    }
  };

  const handleAnalyzeNow = () => {
    if (!geminiConsent) {
      setGeminiConsent(true);
    }
    if (frontImage && !isReading) {
      void runAnalysis(frontImage, backImage, readSucceeded);
    }
  };

  const handleChangeField = <K extends keyof GuestFormData>(
    key: K,
    value: GuestFormData[K]
  ) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleChangeDocumentType = (nextType: DocumentType) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => switchDocumentType(prev, nextType));
  };

  const handleSelectPrimaryMember = (memberId: string) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => selectPrimaryFamilyMember(prev, memberId));
  };

  const handleToggleAccompanyingMember = (memberId: string) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => {
      const exists = prev.accompanyingMemberIds.includes(memberId);
      return {
        ...prev,
        accompanyingMemberIds: exists
          ? prev.accompanyingMemberIds.filter((id) => id !== memberId)
          : [...prev.accompanyingMemberIds, memberId],
      };
    });
  };

  const handleUpdateFamilyMember = (
    memberId: string,
    patch: Partial<FamilyMember>
  ) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => {
      const updatedMembers = prev.familyMembers.map((m) =>
        m.id === memberId ? { ...m, ...patch } : m
      );
      const next = { ...prev, familyMembers: updatedMembers };
      if (prev.primaryMemberId === memberId && patch.fullName !== undefined) {
        next.fullName = patch.fullName;
      }
      if (prev.primaryMemberId === memberId && patch.documentNumber !== undefined) {
        next.documentNumber = patch.documentNumber;
      }
      if (prev.primaryMemberId === memberId && patch.dateOfBirth !== undefined) {
        next.dateOfBirth = patch.dateOfBirth;
      }
      if (prev.primaryMemberId === memberId && patch.birthCalendar !== undefined) {
        next.birthCalendar = patch.birthCalendar;
      }
      if (prev.primaryMemberId === memberId) {
        const editedPrimary = updatedMembers.find((m) => m.id === memberId);
        if (editedPrimary && isMemberUnder18(editedPrimary)) {
          const fallbackAdult = updatedMembers.find((m) => !isMemberUnder18(m));
          if (fallbackAdult) {
            return selectPrimaryFamilyMember(next, fallbackAdult.id);
          }
          next.primaryMemberId = null;
        }
      }
      return next;
    });
  };

  const handleAddFamilyMember = () => {
    setForm((prev) => {
      const newMember: FamilyMember = {
        id: `member_${Date.now()}`,
        fullName: '',
        documentNumber: '',
        sex: '',
        dateOfBirth: '',
        birthCalendar: 'unknown',
        relationship: '',
      };
      const nextMembers = [...prev.familyMembers, newMember];
      return {
        ...prev,
        familyMembers: nextMembers,
        primaryMemberId: prev.primaryMemberId ?? newMember.id,
      };
    });
  };

  const handleRemoveFamilyMember = (memberId: string) => {
    setForm((prev) => ({
      ...prev,
      familyMembers: prev.familyMembers.filter((m) => m.id !== memberId),
      primaryMemberId: prev.primaryMemberId === memberId ? null : prev.primaryMemberId,
      accompanyingMemberIds: prev.accompanyingMemberIds.filter((id) => id !== memberId),
    }));
  };

  const handleSelectPurpose = (purpose: VisitPurposeId) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => ({
      ...prev,
      purposeOfVisit: purpose,
      otherPurposeDetail: purpose === 'other' ? prev.otherPurposeDetail : '',
    }));
  };

  const handleSelectBookingSource = (source: BookingSourceId) => {
    setPreparedMessage(null);
    setPreparedUrl(null);
    setForm((prev) => ({
      ...prev,
      bookingSource: source,
      bookingReference: source === 'booking_com' ? prev.bookingReference : '',
    }));
  };

  const handlePrepareAndOpenWhatsApp = () => {
    setAttemptedSubmit(true);
    if (!validation.canOpenWhatsApp) {
      return;
    }

    const message = buildWhatsAppMessage(form);
    const url = buildWhatsAppUrl(message);
    if (!url) return;

    // Ensure no copy of any document image remains after sending
    purgeImages();

    setPreparedMessage(message);
    setPreparedUrl(url);

    // Open WhatsApp via safe programmatic link without window.open popup blocks or window.alert
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleSubmitToHotel = async () => {
    setAttemptedSubmit(true);
    setSubmitHotelError(null);
    if (!validation.canOpenWhatsApp || !qrHotel) {
      return;
    }

    setIsSubmittingToHotel(true);
    try {
      const sessionId = await createCheckinSession(form, qrHotel);
      purgeImages();
      try {
        window.sessionStorage.setItem(getSessionStorageKey(qrHotel.id), sessionId);
      } catch {
        // Ignore sessionStorage errors
      }
      setActiveSessionId(sessionId);
    } catch (err) {
      setSubmitHotelError(
        err instanceof Error ? err.message : t.errServerFailed
      );
    } finally {
      setIsSubmittingToHotel(false);
    }
  };

  const handleClearAll = () => {
    purgeImages();
    setGeminiConsent(false);
    setIsReading(false);
    setReadSucceeded(false);
    setReadError(null);
    setWarnings([]);
    setUnreadableFields([]);
    setForm(createEmptyGuestForm());
    setLockedFields(createEmptyLockedFields());
    setDeclarationAccepted(false);
    setHotelTermsAccepted(false);
    setAttemptedSubmit(false);
    setPreparedMessage(null);
    setPreparedUrl(null);
    setSubmitHotelError(null);
    setClearedBanner(true);
  };

  const handleResetHotelCheckinSession = () => {
    if (qrHotelId) {
      try {
        window.sessionStorage.removeItem(getSessionStorageKey(qrHotelId));
      } catch {
        // Ignore
      }
    }
    setActiveSessionId(null);
    setActiveSession(null);
    handleClearAll();
    setClearedBanner(false);
  };

  const hasEnteredMobile = Boolean(
    form.mobileNumber.trim() && form.mobileNumber.trim() !== '+966'
  );

  const hasSessionData = Boolean(
    frontImage ||
      backImage ||
      form.fullName ||
      form.documentNumber ||
      form.nationality ||
      hasEnteredMobile ||
      form.purposeOfVisit ||
      form.bookingSource
  );

  const isQrGuestMode = Boolean(qrHotelId);

  const renderGuestContent = () => {
    if (isQrGuestMode) {
      if (loadingQrHotel) {
        return (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-8 text-center shadow-[var(--shadow-card)]">
            <Loader2 className="h-7 w-7 animate-spin text-[#8C5338]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[#685F58]">{t.qrHotelLoading}</p>
          </div>
        );
      }

      if (!qrHotel || !isHotelOperational(qrHotel)) {
        return (
          <section className="mx-auto max-w-lg rounded-3xl border border-[#C58B6D]/40 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C58B6D]/30 bg-[#E8A588]/20 text-[#8C5338]">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-[#2C2C2C] sm:text-xl">
              {t.qrHotelUnavailableTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#685F58]">
              {t.qrHotelUnavailableDesc}
            </p>
          </section>
        );
      }

      if (activeSessionId && activeSession?.status === 'approved') {
        return (
          <GuestApprovedCard
            session={activeSession}
            hotel={qrHotel}
            form={form}
            lang={lang}
            t={t}
            onStartNewCheckin={handleResetHotelCheckinSession}
          />
        );
      }

      if (activeSessionId) {
        return (
          <GuestWaitingCard
            session={activeSession}
            sessionId={activeSessionId}
            hotel={qrHotel}
            guestName={form.fullName}
            t={t}
            onCancel={handleResetHotelCheckinSession}
          />
        );
      }
    }

    return (
      <>
        {isQrGuestMode && qrHotel ? (
          <div className="mb-6 flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF7F2] px-4 py-3 shadow-[var(--shadow-card)]">
            <Building2 className="h-5 w-5 shrink-0 text-[#8C5338]" aria-hidden="true" />
            <span className="text-sm font-medium text-[#685F58]">{t.qrHotelBannerLabel}</span>
            <span className="text-base font-bold text-[#2C2C2C]">{qrHotel.name}</span>
          </div>
        ) : (
          <div className="mb-6">
            <p className="m-0 max-w-2xl text-sm text-[#685F58] sm:text-base">
              {t.appSubtitle}
            </p>
          </div>
        )}

        {clearedBanner && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-[#2C2C2C]/15 bg-[#FAF7F2] px-4 py-3 text-sm font-medium text-[#2C2C2C]"
          >
            {t.clearedSuccess}
          </div>
        )}

        <div className="space-y-5">
          {/* Single-page unified flow: Document photo & Review/Booking/Send */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <div className="lg:sticky lg:top-20 lg:col-span-5">
              <DocumentCapture
                frontImage={frontImage}
                backImage={backImage}
                geminiConsent={geminiConsent}
                isReading={isReading}
                readSucceeded={readSucceeded}
                readError={readError}
                warnings={warnings}
                unreadableFields={unreadableFields}
                onSelectImage={handleSelectImage}
                onRemoveImage={handleRemoveImage}
                onToggleConsent={handleToggleConsent}
                onAnalyzeNow={handleAnalyzeNow}
                t={t}
              />
            </div>

            <div className="space-y-5 lg:col-span-7">
              <GuestDataForm
                form={form}
                lockedFields={lockedFields}
                missingFields={missingFieldsSet}
                onChangeField={handleChangeField}
                onChangeDocumentType={handleChangeDocumentType}
                onSelectPrimaryMember={handleSelectPrimaryMember}
                onToggleAccompanyingMember={handleToggleAccompanyingMember}
                onUpdateFamilyMember={handleUpdateFamilyMember}
                onAddFamilyMember={handleAddFamilyMember}
                onRemoveFamilyMember={handleRemoveFamilyMember}
                t={t}
              />

              <VisitBookingSection
                form={form}
                missingFields={missingFieldsSet}
                onSelectPurpose={handleSelectPurpose}
                onChangeOtherPurpose={(val) => handleChangeField('otherPurposeDetail', val)}
                onSelectBookingSource={handleSelectBookingSource}
                onChangeBookingReference={(val) => handleChangeField('bookingReference', val)}
                t={t}
              />

              <WhatsAppSubmitSection
                validation={validation}
                declarationAccepted={declarationAccepted}
                onToggleDeclaration={(checked) => setDeclarationAccepted(checked)}
                hotelTermsAccepted={hotelTermsAccepted}
                onToggleHotelTerms={(checked) => setHotelTermsAccepted(checked)}
                onPrepareAndOpenWhatsApp={handlePrepareAndOpenWhatsApp}
                preparedMessage={preparedMessage}
                preparedUrl={preparedUrl}
                attemptedSubmit={attemptedSubmit}
                targetHotel={isQrGuestMode ? qrHotel : null}
                isSubmittingToHotel={isSubmittingToHotel}
                submitError={submitHotelError}
                onSubmitToHotel={handleSubmitToHotel}
                lang={lang}
                t={t}
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-dvh bg-[#F4EFEA] text-[#2C2C2C]">
      <HeaderBar
        lang={lang}
        t={t}
        viewMode={viewMode}
        isQrGuestMode={isQrGuestMode}
        onChangeView={(mode) => navigateTo(mode, null)}
        onToggleLanguage={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onClearAll={handleClearAll}
        hasSessionData={hasSessionData}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
        {viewMode === 'hotel' && !isQrGuestMode ? (
          <HotelPortal
            lang={lang}
            t={t}
            onPreviewGuestPage={(hotelId) => navigateTo('guest', hotelId)}
          />
        ) : viewMode === 'owner' && !isQrGuestMode ? (
          <AdminAuthGate t={t}>
            {(user, handleSignOut) => (
              <OwnerDashboard
                lang={lang}
                t={t}
                adminEmail={user.email}
                onSignOut={handleSignOut}
              />
            )}
          </AdminAuthGate>
        ) : (
          renderGuestContent()
        )}
      </main>
    </div>
  );
}
