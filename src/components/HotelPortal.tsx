import { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Banknote,
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquareText,
  PauseCircle,
  Pencil,
  Percent,
  Phone,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Send,
  UserPlus,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import {
  auth,
  formatFirebaseAuthError,
  registerHotelWithEmail,
  resetHotelPassword,
  signInHotelWithEmail,
} from '../lib/firebase';
import {
  approveCheckinSession,
  cancelCheckinSession,
  subscribeToHotelCheckinSessions,
  updateApprovedWelcomeMessage,
} from '../services/checkinSessions';
import {
  DEFAULT_HOTEL_TERMS_AR,
  DEFAULT_HOTEL_TERMS_EN,
  DEFAULT_WELCOME_TEMPLATE_AR,
  DEFAULT_WELCOME_TEMPLATE_EN,
  registerHotel,
  subscribeToOwnerHotels,
  updateHotelTerms,
  updateHotelWelcomeTemplate,
} from '../services/hotels';
import type {
  CheckinSessionRecord,
  HotelWithPrivate,
  Language,
} from '../types/guest';
import {
  buildWhatsAppUrl,
  calculateDiscountPercent,
  formatCurrencyPrice,
  formatWelcomeMessageFromTemplate,
  isHotelExpired,
  isHotelOperational,
  normalizeHotelPhoneToWhatsApp,
  parseValidPrice,
  sanitizeDecimalPriceInput,
  toAsciiDigits,
  WELCOME_MESSAGE_MAX_LENGTH,
} from '../utils/documentRules';
import { playReceptionChime, unlockAudioContext } from '../utils/soundAlert';

interface HotelPortalProps {
  lang: Language;
  t: TranslationKeys;
  onPreviewGuestPage: (hotelId: string) => void;
}

export function HotelPortal({
  lang,
  t,
  onPreviewGuestPage,
}: HotelPortalProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelWithPrivate[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTerms, setRegTerms] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Hotel terms editor state
  const [termsDraft, setTermsDraft] = useState('');
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsSavedMsg, setTermsSavedMsg] = useState(false);
  const syncedTermsHotelRef = useRef<{ id: string; terms: string } | null>(null);

  // Hotel default welcome message template editor state
  const [welcomeTemplateDraft, setWelcomeTemplateDraft] = useState('');
  const [savingWelcomeTemplate, setSavingWelcomeTemplate] = useState(false);
  const [welcomeTemplateSavedMsg, setWelcomeTemplateSavedMsg] = useState(false);
  const syncedWelcomeHotelRef = useRef<{ id: string; template: string } | null>(null);
  const welcomeTemplateInputRef = useRef<HTMLTextAreaElement | null>(null);

  // QR & Link state
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Live guest check-in requests state
  const [sessions, setSessions] = useState<CheckinSessionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'cancelled' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [roomInputs, setRoomInputs] = useState<Record<string, string>>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [discountedPriceInputs, setDiscountedPriceInputs] = useState<Record<string, string>>({});
  const [welcomeInputs, setWelcomeInputs] = useState<Record<string, string>>({});
  const [editingWelcomeSessionId, setEditingWelcomeSessionId] = useState<string | null>(null);
  const [editingWelcomeDrafts, setEditingWelcomeDrafts] = useState<Record<string, string>>({});
  const [savingWelcomeSessionId, setSavingWelcomeSessionId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser?.email) {
        setRegEmail((prev) => (prev.trim() ? prev : nextUser.email ?? ''));
      }
      if (!nextUser) {
        setHotels([]);
        setLoadingHotels(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingHotels(true);
    const unsub = subscribeToOwnerHotels(
      user.uid,
      (list) => {
        setHotels(list);
        setLoadingHotels(false);
        setSelectedHotelId((prev) => {
          if (prev && list.some((h) => h.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      },
      (err) => {
        setLoadingHotels(false);
        setActionError(err instanceof Error ? err.message : 'Failed to load hotels.');
      }
    );
    return () => unsub();
  }, [user]);

  const activeHotel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId) ?? hotels[0] ?? null,
    [hotels, selectedHotelId]
  );

  const guestCheckinUrl = useMemo(() => {
    if (!activeHotel || typeof window === 'undefined') return '';
    return `${window.location.origin}/?hotel=${encodeURIComponent(activeHotel.id)}`;
  }, [activeHotel]);

  const hotelIsOperational = activeHotel ? isHotelOperational(activeHotel) : false;
  const hotelIsExpired = activeHotel ? isHotelExpired(activeHotel) : false;
  const defaultTermsTemplate = lang === 'en' ? DEFAULT_HOTEL_TERMS_EN : DEFAULT_HOTEL_TERMS_AR;
  const defaultWelcomeTemplate =
    lang === 'en' ? DEFAULT_WELCOME_TEMPLATE_EN : DEFAULT_WELCOME_TEMPLATE_AR;

  // Sync hotel terms editor draft when switching hotel or when backend terms update
  useEffect(() => {
    if (!activeHotel) {
      syncedTermsHotelRef.current = null;
      setTermsDraft('');
      setTermsSavedMsg(false);
      return;
    }
    const serverTerms = activeHotel.termsText ?? '';
    const prevSync = syncedTermsHotelRef.current;
    if (!prevSync || prevSync.id !== activeHotel.id || prevSync.terms !== serverTerms) {
      syncedTermsHotelRef.current = { id: activeHotel.id, terms: serverTerms };
      setTermsDraft(serverTerms.trim() ? serverTerms : defaultTermsTemplate);
      setTermsSavedMsg(false);
    }
  }, [activeHotel, defaultTermsTemplate]);

  // Sync hotel welcome message template draft when switching hotel or backend update
  useEffect(() => {
    if (!activeHotel) {
      syncedWelcomeHotelRef.current = null;
      setWelcomeTemplateDraft('');
      setWelcomeTemplateSavedMsg(false);
      return;
    }
    const serverTemplate = activeHotel.welcomeTemplate ?? '';
    const prevSync = syncedWelcomeHotelRef.current;
    if (!prevSync || prevSync.id !== activeHotel.id || prevSync.template !== serverTemplate) {
      syncedWelcomeHotelRef.current = { id: activeHotel.id, template: serverTemplate };
      setWelcomeTemplateDraft(
        serverTemplate.trim() ? serverTemplate : defaultWelcomeTemplate
      );
      setWelcomeTemplateSavedMsg(false);
    }
  }, [activeHotel, defaultWelcomeTemplate]);

  // Render crisp QR code onto canvas whenever activeHotel is operational
  useEffect(() => {
    if (!activeHotel || !hotelIsOperational || !guestCheckinUrl || !qrCanvasRef.current) {
      return;
    }
    void QRCode.toCanvas(qrCanvasRef.current, guestCheckinUrl, {
      width: 220,
      margin: 2,
      color: {
        dark: '#2C2C2C',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  }, [activeHotel, hotelIsOperational, guestCheckinUrl]);

  // Subscribe to real-time guest check-ins for the active hotel
  useEffect(() => {
    if (!user || !activeHotel || activeHotel.status !== 'approved') {
      setSessions([]);
      return;
    }

    const unsub = subscribeToHotelCheckinSessions(
      activeHotel.id,
      user.uid,
      (list, newlyAddedPendingIds) => {
        setSessions(list);
        if (newlyAddedPendingIds.length > 0 && soundEnabledRef.current) {
          void playReceptionChime();
        }
      },
      (err) => {
        setActionError(err instanceof Error ? err.message : 'Failed to load guest check-ins.');
      }
    );

    return () => unsub();
  }, [user, activeHotel]);

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSent(false);

    const cleanEmail = authEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError(t.hotelErrEmailInvalid);
      return;
    }
    if (authPassword.length < 6) {
      setAuthError(t.hotelAuthErrPasswordShort);
      return;
    }
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError(t.hotelAuthErrPasswordMismatch);
      return;
    }

    setSigningIn(true);
    try {
      if (authMode === 'register') {
        await registerHotelWithEmail(cleanEmail, authPassword);
      } else {
        await signInHotelWithEmail(cleanEmail, authPassword);
      }
      setAuthPassword('');
      setAuthConfirmPassword('');
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError(null);
    setResetSent(false);
    const cleanEmail = authEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError(t.hotelErrEmailInvalid);
      return;
    }
    setSendingReset(true);
    try {
      await resetHotelPassword(cleanEmail);
      setResetSent(true);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
    } finally {
      setSendingReset(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRegError(null);

    if (!regName.trim()) {
      setRegError(t.hotelErrNameRequired);
      return;
    }
    const normalizedPhone = normalizeHotelPhoneToWhatsApp(regPhone);
    if (normalizedPhone.length < 7 || normalizedPhone.length > 25) {
      setRegError(t.hotelErrPhoneInvalid);
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError(t.hotelErrEmailInvalid);
      return;
    }

    setRegSubmitting(true);
    try {
      const created = await registerHotel({
        name: regName,
        receptionPhone: regPhone,
        email: regEmail,
        ownerUid: user.uid,
        ownerEmail: user.email ?? regEmail,
        termsText: regTerms.trim() ? regTerms : defaultTermsTemplate,
      });
      setRegName('');
      setRegPhone('');
      setRegTerms('');
      setSelectedHotelId(created.id);
      setShowRegisterForm(false);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Failed to register hotel.');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) return;
    setSavingTerms(true);
    setTermsSavedMsg(false);
    setActionError(null);
    try {
      await updateHotelTerms(activeHotel.id, termsDraft);
      syncedTermsHotelRef.current = {
        id: activeHotel.id,
        terms: termsDraft.trim().slice(0, 4000),
      };
      setTermsSavedMsg(true);
      setTimeout(() => setTermsSavedMsg(false), 3000);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to save hotel terms.'
      );
    } finally {
      setSavingTerms(false);
    }
  };

  const handleSaveWelcomeTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) return;
    setSavingWelcomeTemplate(true);
    setWelcomeTemplateSavedMsg(false);
    setActionError(null);
    try {
      const cleaned = welcomeTemplateDraft.trim().slice(0, WELCOME_MESSAGE_MAX_LENGTH);
      await updateHotelWelcomeTemplate(activeHotel.id, cleaned);
      syncedWelcomeHotelRef.current = {
        id: activeHotel.id,
        template: cleaned,
      };
      setWelcomeTemplateSavedMsg(true);
      setTimeout(() => setWelcomeTemplateSavedMsg(false), 3000);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to save welcome template.'
      );
    } finally {
      setSavingWelcomeTemplate(false);
    }
  };

  const handleInsertPlaceholder = (token: string) => {
    const el = welcomeTemplateInputRef.current;
    setWelcomeTemplateSavedMsg(false);
    if (!el || typeof el.selectionStart !== 'number') {
      setWelcomeTemplateDraft((prev) =>
        `${prev}${prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''}${token}`.slice(
          0,
          WELCOME_MESSAGE_MAX_LENGTH
        )
      );
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd ?? start;
    const current = welcomeTemplateDraft;
    const nextValue = `${current.slice(0, start)}${token}${current.slice(end)}`.slice(
      0,
      WELCOME_MESSAGE_MAX_LENGTH
    );
    setWelcomeTemplateDraft(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      const nextCaret = Math.min(start + token.length, nextValue.length);
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleSaveEditedWelcome = async (sessionId: string) => {
    const draft = (editingWelcomeDrafts[sessionId] ?? '').trim();
    if (!draft) return;

    setSavingWelcomeSessionId(sessionId);
    setActionError(null);
    try {
      await updateApprovedWelcomeMessage(sessionId, draft);
      setEditingWelcomeSessionId((prev) => (prev === sessionId ? null : prev));
      setEditingWelcomeDrafts((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update welcome message.'
      );
    } finally {
      setSavingWelcomeSessionId(null);
    }
  };

  const handleCopyQrLink = async () => {
    if (!guestCheckinUrl) return;
    try {
      await navigator.clipboard.writeText(guestCheckinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadPoster = () => {
    const qrCanvas = qrCanvasRef.current;
    if (!qrCanvas || !activeHotel) return;

    const exportCanvas = document.createElement('canvas');
    const qrSize = qrCanvas.width;
    const padX = 56;
    const padTop = 92;
    const padBottom = 88;
    exportCanvas.width = qrSize + padX * 2;
    exportCanvas.height = qrSize + padTop + padBottom;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FAF7F2';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.strokeStyle = '#C58B6D';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, exportCanvas.width - 24, exportCanvas.height - 24);

    ctx.fillStyle = '#2C2C2C';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(activeHotel.name, exportCanvas.width / 2, 52);

    ctx.fillStyle = '#8C5338';
    ctx.font = '13px sans-serif';
    ctx.fillText(
      'تسجيل الدخول السريع للنزلاء · Guest Self Check-In',
      exportCanvas.width / 2,
      76
    );

    ctx.drawImage(qrCanvas, padX, padTop);

    ctx.fillStyle = '#2C2C2C';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(
      'امسح الباركود لتجهيز بيانات الإقامة',
      exportCanvas.width / 2,
      padTop + qrSize + 36
    );
    ctx.fillStyle = '#685F58';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      'Scan QR Code to submit check-in details',
      exportCanvas.width / 2,
      padTop + qrSize + 58
    );

    const pngUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `hotel-qr-${activeHotel.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDefaultWelcome = (hotelName: string, guestName: string, roomNumber: string) =>
    formatWelcomeMessageFromTemplate(activeHotel?.welcomeTemplate, {
      hotelName,
      guestName,
      roomNumber,
      lang,
    });

  const handleApproveGuest = async (session: CheckinSessionRecord) => {
    if (!activeHotel) return;
    await unlockAudioContext();
    const roomNumber = (roomInputs[session.id] ?? '').trim();
    if (!roomNumber) return;

    const parsedOriginal = parseValidPrice(priceInputs[session.id] ?? '');
    const parsedDiscounted = parseValidPrice(discountedPriceInputs[session.id] ?? '');
    if (
      parsedOriginal === null ||
      parsedOriginal <= 0 ||
      parsedDiscounted === null ||
      parsedDiscounted > parsedOriginal
    ) {
      setActionError(
        parsedOriginal !== null && parsedOriginal <= 0
          ? t.hotelPricingErrZeroOriginal
          : t.hotelPricingErrExceeds
      );
      return;
    }

    const welcomeText = (
      welcomeInputs[session.id] ??
      getDefaultWelcome(activeHotel.name, session.guestName, roomNumber)
    ).trim();
    if (!welcomeText) return;

    setApprovingId(session.id);
    setActionError(null);
    try {
      await approveCheckinSession(
        session.id,
        roomNumber,
        welcomeText,
        parsedOriginal,
        parsedDiscounted
      );
      setRoomInputs((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
      setPriceInputs((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
      setDiscountedPriceInputs((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
      setWelcomeInputs((prev) => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to approve guest check-in.'
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancelGuestRequest = async (sessionId: string) => {
    setCancellingId(sessionId);
    setActionError(null);
    try {
      await cancelCheckinSession(sessionId);
      setConfirmCancelId((prev) => (prev === sessionId ? null : prev));
      setRoomInputs((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setPriceInputs((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setDiscountedPriceInputs((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setWelcomeInputs((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to cancel guest check-in.'
      );
    } finally {
      setCancellingId(null);
    }
  };

  const pendingCount = useMemo(
    () => sessions.filter((s) => s.status === 'pending').length,
    [sessions]
  );
  const approvedCount = useMemo(
    () => sessions.filter((s) => s.status === 'approved').length,
    [sessions]
  );
  const cancelledCount = useMemo(
    () => sessions.filter((s) => s.status === 'cancelled').length,
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (activeTab === 'pending' && s.status !== 'pending') return false;
      if (activeTab === 'approved' && s.status !== 'approved') return false;
      if (activeTab === 'cancelled' && s.status !== 'cancelled') return false;
      if (!q) return true;
      return (
        s.guestName.toLowerCase().includes(q) ||
        s.nationality.toLowerCase().includes(q) ||
        (s.passportData.documentNumber ?? '').toLowerCase().includes(q) ||
        (s.passportData.mobileNumber ?? '').toLowerCase().includes(q) ||
        (s.roomNumber ?? '').toLowerCase().includes(q)
      );
    });
  }, [sessions, activeTab, searchQuery]);

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!authReady) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-8 text-center shadow-[var(--shadow-card)]">
        <Loader2 className="h-7 w-7 animate-spin text-[#8C5338]" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-[#685F58]">{t.adminSigningIn}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C58B6D]/30 bg-[#E8A588]/20 text-[#8C5338]">
            <Building2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-[#2C2C2C] sm:text-2xl">
            {t.hotelSignInTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#685F58]">
            {t.hotelSignInDesc}
          </p>
        </div>

        {/* Mode Toggle: Sign In vs Create Account */}
        <div className="mt-5 grid grid-cols-2 rounded-2xl bg-[#F4EFEA] p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setAuthError(null);
              setResetSent(false);
            }}
            className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
              authMode === 'signin'
                ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                : 'text-[#685F58] hover:text-[#2C2C2C]'
            }`}
          >
            {t.hotelAuthTabSignIn}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setAuthError(null);
              setResetSent(false);
            }}
            className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
              authMode === 'register'
                ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                : 'text-[#685F58] hover:text-[#2C2C2C]'
            }`}
          >
            {t.hotelAuthTabRegister}
          </button>
        </div>

        <form onSubmit={handleEmailAuthSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="hotel-auth-email"
              className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
            >
              {t.hotelAuthEmailLabel}
              <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
            </label>
            <input
              id="hotel-auth-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={authEmail}
              onChange={(e) => {
                setAuthEmail(e.target.value);
                setAuthError(null);
              }}
              placeholder={t.hotelAuthEmailPlaceholder}
              className="ltr-field min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
            />
          </div>

          <div>
            <label
              htmlFor="hotel-auth-password"
              className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
            >
              {t.hotelAuthPasswordLabel}
              <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
            </label>
            <div className="relative">
              <input
                id="hotel-auth-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                value={authPassword}
                onChange={(e) => {
                  setAuthPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder={t.hotelAuthPasswordPlaceholder}
                className="ltr-field min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] pe-11 ps-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-[#685F58] hover:text-[#2C2C2C]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <div>
              <label
                htmlFor="hotel-auth-confirm-password"
                className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
              >
                {t.hotelAuthConfirmPasswordLabel}
                <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
              </label>
              <input
                id="hotel-auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="new-password"
                value={authConfirmPassword}
                onChange={(e) => {
                  setAuthConfirmPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder={t.hotelAuthConfirmPasswordPlaceholder}
                className="ltr-field min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
              />
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-3.5 py-2.5 text-xs font-medium text-[#9E3B33] sm:text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          {resetSent && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 px-3.5 py-2.5 text-xs font-medium text-[#2E6B47] sm:text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t.hotelAuthResetSent}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={signingIn}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-5 py-3 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] disabled:opacity-60"
          >
            {signingIn ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
            ) : authMode === 'register' ? (
              <UserPlus className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
            ) : (
              <LogIn className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
            )}
            <span>
              {signingIn
                ? authMode === 'register'
                  ? t.hotelAuthCreatingAccount
                  : t.hotelAuthSigningIn
                : authMode === 'register'
                  ? t.hotelAuthCreateAccountButton
                  : t.hotelSignInButton}
            </span>
          </button>

          {authMode === 'signin' && (
            <div className="text-center">
              <button
                type="button"
                disabled={sendingReset}
                onClick={handleForgotPassword}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-xs font-semibold text-[#8C5338] hover:underline disabled:opacity-50"
              >
                {sendingReset ? '...' : t.hotelAuthForgotPassword}
              </button>
            </div>
          )}
        </form>
      </section>
    );
  }

  if (loadingHotels) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-8 text-center shadow-[var(--shadow-card)]">
        <Loader2 className="h-7 w-7 animate-spin text-[#8C5338]" aria-hidden="true" />
      </div>
    );
  }

  const renderRegistrationForm = () => (
    <section className="mx-auto max-w-xl rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-[#2C2C2C]/10 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#2C2C2C] sm:text-2xl">
            {t.hotelRegTitle}
          </h2>
          <p className="mt-1 text-sm text-[#685F58]">{t.hotelRegDesc}</p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.adminSignOutButton}</span>
        </button>
      </div>

      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="hotel-reg-name"
            className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
          >
            {t.hotelNameLabel}
            <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
          </label>
          <input
            id="hotel-reg-name"
            type="text"
            value={regName}
            onChange={(e) => {
              setRegName(e.target.value);
              setRegError(null);
            }}
            placeholder={t.hotelNamePlaceholder}
            maxLength={150}
            className="min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
          />
        </div>

        <div>
          <label
            htmlFor="hotel-reg-phone"
            className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
          >
            {t.hotelPhoneLabel}
            <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
          </label>
          <input
            id="hotel-reg-phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={regPhone}
            onChange={(e) => {
              setRegPhone(toAsciiDigits(e.target.value));
              setRegError(null);
            }}
            placeholder={t.hotelPhonePlaceholder}
            maxLength={25}
            className="ltr-field tabular-nums min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
          />
        </div>

        <div>
          <label
            htmlFor="hotel-reg-email"
            className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
          >
            {t.hotelEmailLabel}
            <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
          </label>
          <input
            id="hotel-reg-email"
            type="email"
            dir="ltr"
            value={regEmail}
            onChange={(e) => {
              setRegEmail(e.target.value);
              setRegError(null);
            }}
            placeholder={t.hotelEmailPlaceholder}
            maxLength={200}
            className="ltr-field min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
          />
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="hotel-reg-terms"
              className="block text-sm font-semibold text-[#2C2C2C]"
            >
              {t.hotelTermsInputLabel}
            </label>
            <button
              type="button"
              onClick={() => setRegTerms(defaultTermsTemplate)}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#2C2C2C]/15 bg-[#F4EFEA] px-2.5 py-1 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/20"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>{t.hotelTermsResetDefault}</span>
            </button>
          </div>
          <textarea
            id="hotel-reg-terms"
            rows={4}
            value={regTerms}
            onChange={(e) => setRegTerms(e.target.value)}
            placeholder={t.hotelTermsPlaceholder}
            maxLength={4000}
            className="w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm leading-relaxed text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
          />
        </div>

        {regError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-3.5 py-2.5 text-xs font-medium text-[#9E3B33] sm:text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{regError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="submit"
            disabled={regSubmitting}
            className="inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-6 py-3 text-sm font-bold text-[#FAF7F2] shadow-sm transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] disabled:opacity-55"
          >
            {regSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
            )}
            <span>{regSubmitting ? t.hotelSubmittingReg : t.hotelSubmitRegButton}</span>
          </button>

          {hotels.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRegisterForm(false)}
              className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-5 py-3 text-sm font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
            >
              {t.ownerCancelDelete}
            </button>
          )}
        </div>
      </form>
    </section>
  );

  if (hotels.length === 0 || showRegisterForm || !activeHotel) {
    return renderRegistrationForm();
  }

  return (
    <div className="space-y-5">
      {/* Top Hotel Account & Switcher Bar */}
      <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#685F58]">
              <span>{t.hotelPortalTitle}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-bold ${
                  hotelIsOperational
                    ? 'text-[#2E6B47]'
                    : activeHotel.status === 'pending'
                      ? 'text-[#8C5338]'
                      : 'text-[#9E3B33]'
                }`}
              >
                {activeHotel.status === 'pending'
                  ? t.statusPending
                  : activeHotel.status === 'suspended'
                    ? t.statusSuspended
                    : hotelIsExpired
                      ? t.statusExpired
                      : t.statusActive}
              </span>
              {activeHotel.expiresAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {t.hotelExpiryLabel}: {formatDate(activeHotel.expiresAt)}
                  </span>
                </>
              )}
            </div>

            <h2 className="mt-1 text-xl font-bold text-[#2C2C2C] sm:text-2xl">
              {activeHotel.name}
            </h2>

            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-[#685F58] sm:text-sm">
              {activeHotel.receptionPhone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-[#8C5338]" aria-hidden="true" />
                  <span className="ltr-field tabular-nums font-medium text-[#2C2C2C]">
                    +{activeHotel.receptionPhone}
                  </span>
                </span>
              )}
              {activeHotel.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[#8C5338]" aria-hidden="true" />
                  <span className="ltr-field font-medium text-[#2C2C2C]">
                    {activeHotel.email}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hotels.length > 1 && (
              <select
                value={activeHotel.id}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                aria-label={t.hotelSwitchLabel}
                className="min-h-[44px] rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 text-sm font-semibold text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowRegisterForm(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20 whitespace-nowrap"
            >
              <Plus className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
              <span>{t.hotelRegisterAnother}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.adminSignOutButton}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pending / Suspended / Expired States */}
      {activeHotel.status === 'pending' && (
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#C58B6D]/40 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8A588]/25 text-[#8C5338]">
            <Clock className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-[#2C2C2C] sm:text-xl">
            {t.hotelPendingTitle}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#685F58]">
            {t.hotelPendingDesc}
          </p>
        </section>
      )}

      {activeHotel.status === 'suspended' && (
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#9E3B33]/30 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9E3B33]/10 text-[#9E3B33]">
            <PauseCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-[#2C2C2C] sm:text-xl">
            {t.hotelSuspendedTitle}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#685F58]">
            {t.hotelSuspendedDesc}
          </p>
        </section>
      )}

      {hotelIsExpired && (
        <section className="mx-auto max-w-2xl rounded-3xl border border-[#9E3B33]/30 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9E3B33]/10 text-[#9E3B33]">
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-[#2C2C2C] sm:text-xl">
            {t.hotelExpiredTitle}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#685F58]">
            {t.hotelExpiredDesc}
          </p>
        </section>
      )}

      {/* Approved & Active Dedicated Hotel Page: Reception QR + Real-Time Guest Requests */}
      {activeHotel.status === 'approved' && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* Left/Top Column: Dedicated Reception QR Code & Hotel Terms Editor */}
          {hotelIsOperational && (
            <div className="space-y-5 lg:sticky lg:top-20 lg:col-span-4">
              <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-[#8C5338]" aria-hidden="true" />
                  <h3 className="text-lg font-bold text-[#2C2C2C]">{t.hotelQrTitle}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#685F58] sm:text-sm">
                  {t.hotelQrDesc}
                </p>

                <div className="my-5 flex justify-center rounded-2xl border border-[#2C2C2C]/10 bg-[#FFFFFF] p-5">
                  <canvas ref={qrCanvasRef} className="max-w-full" />
                </div>

                <div className="mb-4 rounded-xl border border-[#2C2C2C]/10 bg-[#F4EFEA]/80 px-3 py-2 text-xs">
                  <span className="ltr-field block break-all font-mono text-[#2C2C2C]">
                    {guestCheckinUrl}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadPoster}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-4 py-2.5 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90"
                  >
                    <Download className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
                    <span>{t.hotelQrDownload}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyQrLink}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#2E6B47]" aria-hidden="true" />
                          <span>{t.hotelQrCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.hotelQrCopyLink}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreviewGuestPage(activeHotel.id)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/20"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.hotelQrPreviewGuest}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Editable Hotel Terms & Policies Card */}
              <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#8C5338]" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-[#2C2C2C]">
                      {t.hotelTermsSectionTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTermsDraft(defaultTermsTemplate);
                      setTermsSavedMsg(false);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-2.5 py-1 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.hotelTermsResetDefault}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#685F58] sm:text-sm">
                  {t.hotelTermsSectionDesc}
                </p>

                <form onSubmit={handleSaveTerms} className="mt-4 space-y-3">
                  <label htmlFor="hotel-terms-editor" className="sr-only">
                    {t.hotelTermsInputLabel}
                  </label>
                  <textarea
                    id="hotel-terms-editor"
                    rows={6}
                    value={termsDraft}
                    onChange={(e) => {
                      setTermsDraft(e.target.value);
                      setTermsSavedMsg(false);
                    }}
                    placeholder={t.hotelTermsPlaceholder}
                    maxLength={4000}
                    className="w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm leading-relaxed text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                  />

                  {termsSavedMsg && (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 px-3 py-2 text-xs font-semibold text-[#2E6B47]"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t.hotelTermsSavedSuccess}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingTerms}
                    className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-4 py-2.5 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 disabled:opacity-60"
                  >
                    {savingTerms ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
                    ) : (
                      <Save className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
                    )}
                    <span>
                      {savingTerms ? t.hotelTermsSavingButton : t.hotelTermsSaveButton}
                    </span>
                  </button>
                </form>
              </section>

              {/* Editable Hotel Default Welcome Message Card */}
              <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-[#8C5338]" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-[#2C2C2C]">
                      {t.hotelWelcomeTemplateTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWelcomeTemplateDraft(defaultWelcomeTemplate);
                      setWelcomeTemplateSavedMsg(false);
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-2.5 py-1 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.hotelWelcomeTemplateResetDefault}</span>
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#685F58] sm:text-sm">
                  {t.hotelWelcomeTemplateDesc}
                </p>

                <form onSubmit={handleSaveWelcomeTemplate} className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#685F58]">
                      {t.hotelWelcomePlaceholdersLabel}
                    </span>
                    {[
                      {
                        label: t.hotelWelcomePlaceholderHotel,
                        token: lang === 'ar' ? '{الفندق}' : '{hotel}',
                      },
                      {
                        label: t.hotelWelcomePlaceholderGuest,
                        token: lang === 'ar' ? '{النزيل}' : '{guest}',
                      },
                      {
                        label: t.hotelWelcomePlaceholderRoom,
                        token: lang === 'ar' ? '{الغرفة}' : '{room}',
                      },
                    ].map((chip) => (
                      <button
                        key={chip.token}
                        type="button"
                        onClick={() => handleInsertPlaceholder(chip.token)}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#C58B6D]/35 bg-[#FFFFFF] px-2.5 py-1 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/15"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>{chip.label}</span>
                      </button>
                    ))}
                  </div>

                  <label htmlFor="hotel-welcome-template-editor" className="sr-only">
                    {t.hotelWelcomeTemplateInputLabel}
                  </label>
                  <textarea
                    ref={welcomeTemplateInputRef}
                    id="hotel-welcome-template-editor"
                    rows={4}
                    value={welcomeTemplateDraft}
                    onChange={(e) => {
                      setWelcomeTemplateDraft(e.target.value);
                      setWelcomeTemplateSavedMsg(false);
                    }}
                    placeholder={t.hotelWelcomeTemplatePlaceholder}
                    maxLength={WELCOME_MESSAGE_MAX_LENGTH}
                    className="w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3.5 py-2.5 text-sm leading-relaxed text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                  />
                  <div className="flex justify-end text-[11px] font-medium tabular-nums text-[#685F58]">
                    {welcomeTemplateDraft.length}/{WELCOME_MESSAGE_MAX_LENGTH}
                  </div>

                  {welcomeTemplateSavedMsg && (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 px-3 py-2 text-xs font-semibold text-[#2E6B47]"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t.hotelWelcomeTemplateSavedSuccess}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingWelcomeTemplate}
                    className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-4 py-2.5 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 disabled:opacity-60"
                  >
                    {savingWelcomeTemplate ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
                    ) : (
                      <Save className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
                    )}
                    <span>
                      {savingWelcomeTemplate
                        ? t.hotelWelcomeTemplateSavingButton
                        : t.hotelWelcomeTemplateSaveButton}
                    </span>
                  </button>
                </form>
              </section>
            </div>
          )}

          {/* Right/Main Column: Incoming Guest Check-Ins */}
          <div className={hotelIsOperational ? 'space-y-4 lg:col-span-8' : 'space-y-4 lg:col-span-12'}>
            <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#2C2C2C] sm:text-xl">
                    {t.hotelRequestsTitle}
                  </h3>
                  <p className="mt-1 text-xs text-[#685F58] sm:text-sm">
                    {t.hotelRequestsDesc}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await unlockAudioContext();
                      setSoundEnabled((prev) => !prev);
                    }}
                    aria-pressed={soundEnabled}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
                      soundEnabled
                        ? 'border-[#2E6B47]/35 bg-[#2E6B47]/10 text-[#2E6B47]'
                        : 'border-[#2C2C2C]/15 bg-[#F4EFEA] text-[#685F58]'
                    }`}
                  >
                    {soundEnabled ? (
                      <Bell className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <BellOff className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{soundEnabled ? t.hotelSoundOn : t.hotelSoundOff}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await unlockAudioContext();
                      await playReceptionChime();
                    }}
                    aria-label="Test sound"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] text-[#8C5338] hover:bg-[#E8A588]/20"
                  >
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-[#2C2C2C]/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex flex-wrap rounded-xl bg-[#F4EFEA] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pending');
                      setActionError(null);
                    }}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                      activeTab === 'pending'
                        ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                        : 'text-[#685F58] hover:text-[#2C2C2C]'
                    }`}
                  >
                    <span>{t.hotelTabPending}</span>
                    <span className="tabular-nums font-mono text-[#8C5338]">
                      ({pendingCount})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('approved');
                      setActionError(null);
                    }}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                      activeTab === 'approved'
                        ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                        : 'text-[#685F58] hover:text-[#2C2C2C]'
                    }`}
                  >
                    <span>{t.hotelTabApproved}</span>
                    <span className="tabular-nums font-mono text-[#2E6B47]">
                      ({approvedCount})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('cancelled');
                      setActionError(null);
                    }}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                      activeTab === 'cancelled'
                        ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                        : 'text-[#685F58] hover:text-[#2C2C2C]'
                    }`}
                  >
                    <span>{t.hotelTabCancelled}</span>
                    <span className="tabular-nums font-mono text-[#9E3B33]">
                      ({cancelledCount})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('all');
                      setActionError(null);
                    }}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${
                      activeTab === 'all'
                        ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                        : 'text-[#685F58] hover:text-[#2C2C2C]'
                    }`}
                  >
                    <span>{t.hotelTabAll}</span>
                    <span className="tabular-nums font-mono">({sessions.length})</span>
                  </button>
                </div>

                <div className="relative sm:w-64">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#685F58]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.hotelSearchGuestsPlaceholder}
                    className="min-h-[44px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] pe-3 ps-9 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                  />
                </div>
              </div>
            </section>

            {actionError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 p-4 text-sm text-[#9E3B33]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="m-0 font-medium">{actionError}</p>
              </div>
            )}

            {filteredSessions.length === 0 ? (
              <div className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-10 text-center shadow-[var(--shadow-card)]">
                <CheckCircle2
                  className="mx-auto h-10 w-10 text-[#685F58]/50"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium text-[#685F58]">
                  {t.hotelEmptyRequests}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSessions.map((session) => {
                  const pd = session.passportData;
                  const isPending = session.status === 'pending';
                  const docTypeLabel = t.docTypes[pd.documentType] ?? pd.documentType;
                  const purposeLabel = pd.purposeOfVisit
                    ? pd.purposeOfVisit === 'other' && pd.otherPurposeDetail
                      ? `${t.purposes.other}: ${pd.otherPurposeDetail}`
                      : t.purposes[pd.purposeOfVisit] ?? pd.purposeOfVisit
                    : '—';
                  const bookingLabel = pd.bookingSource
                    ? t.bookingSources[pd.bookingSource] ?? pd.bookingSource
                    : '—';
                  const accompanying = (pd.familyMembers ?? []).filter(
                    (m) =>
                      m.id !== pd.primaryMemberId &&
                      (pd.accompanyingMemberIds ?? []).includes(m.id)
                  );
                  const roomVal = roomInputs[session.id] ?? '';
                  const priceRaw = priceInputs[session.id] ?? '';
                  const discountedRaw = discountedPriceInputs[session.id] ?? '';
                  const parsedRoomPrice = parseValidPrice(priceRaw);
                  const parsedDiscountedPrice = parseValidPrice(discountedRaw);
                  const autoDiscountPercent =
                    parsedRoomPrice !== null && parsedDiscountedPrice !== null
                      ? calculateDiscountPercent(parsedRoomPrice, parsedDiscountedPrice)
                      : null;
                  const pricingValidationError =
                    parsedRoomPrice !== null && parsedRoomPrice <= 0
                      ? t.hotelPricingErrZeroOriginal
                      : parsedRoomPrice !== null &&
                          parsedDiscountedPrice !== null &&
                          parsedDiscountedPrice > parsedRoomPrice
                        ? t.hotelPricingErrExceeds
                        : null;
                  const welcomeVal =
                    welcomeInputs[session.id] ??
                    getDefaultWelcome(activeHotel.name, session.guestName, roomVal);
                  const isApproving = approvingId === session.id;
                  const isCancelling = cancellingId === session.id;
                  const isConfirmingCancel = confirmCancelId === session.id;
                  const approvedFinalPrice =
                    typeof session.discountedPrice === 'number'
                      ? session.discountedPrice
                      : typeof session.roomPrice === 'number'
                        ? session.roomPrice
                        : null;
                  const guestWhatsAppText =
                    session.status === 'approved'
                      ? [
                          session.welcomeMessage ?? '',
                          `${t.approvedRoomLabel}: ${session.roomNumber ?? ''}`,
                          ...(approvedFinalPrice !== null
                            ? [`${t.approvedPriceLabel}: ${formatCurrencyPrice(approvedFinalPrice, lang)}`]
                            : []),
                        ]
                          .filter(Boolean)
                          .join('\n')
                      : '';
                  const guestWhatsAppUrl =
                    session.status === 'approved' && pd.mobileNumber
                      ? buildWhatsAppUrl(guestWhatsAppText, pd.mobileNumber)
                      : '';

                  return (
                    <article
                      key={session.id}
                      className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6"
                    >
                      <div className="flex flex-col gap-3 border-b border-[#2C2C2C]/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-[#2C2C2C]">
                            {session.guestName}
                          </h4>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#685F58] sm:text-sm">
                            <span>{session.nationality}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {t.hotelSubmittedAtLabel} {formatTime(session.createdAt)}
                            </span>
                          </div>
                        </div>

                        {session.status === 'approved' && session.roomNumber && (
                          <div className="inline-flex items-center gap-2 self-start rounded-xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 px-3.5 py-2 text-sm font-bold text-[#2E6B47]">
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                            <span>{t.hotelAssignedRoomBadge}</span>
                            <span className="ltr-field tabular-nums">{session.roomNumber}</span>
                          </div>
                        )}
                        {session.status === 'cancelled' && (
                          <div className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-3.5 py-2 text-xs font-bold text-[#9E3B33]">
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            <span>{t.hotelStatusCancelledBadge}</span>
                          </div>
                        )}
                      </div>

                      {/* Guest Document Details */}
                      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-[#685F58]">{t.hotelDocLabel}</dt>
                          <dd className="mt-0.5 font-semibold text-[#2C2C2C]">
                            {docTypeLabel} ·{' '}
                            <span className="ltr-field tabular-nums font-mono">
                              {pd.documentNumber || '—'}
                            </span>
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-medium text-[#685F58]">{t.hotelDobLabel}</dt>
                          <dd className="ltr-field tabular-nums mt-0.5 font-semibold text-[#2C2C2C]">
                            {pd.dateOfBirth || '—'}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-xs font-medium text-[#685F58]">{t.hotelMobileLabel}</dt>
                          <dd className="ltr-field tabular-nums mt-0.5 font-semibold text-[#2C2C2C]">
                            {pd.mobileNumber || '—'}
                          </dd>
                        </div>

                        {pd.expiryDate && (
                          <div>
                            <dt className="text-xs font-medium text-[#685F58]">
                              {t.hotelExpiryDocLabel}
                            </dt>
                            <dd className="ltr-field tabular-nums mt-0.5 font-semibold text-[#2C2C2C]">
                              {pd.expiryDate}
                            </dd>
                          </div>
                        )}

                        {pd.versionNumber && (
                          <div>
                            <dt className="text-xs font-medium text-[#685F58]">
                              {t.hotelVersionLabel}
                            </dt>
                            <dd className="ltr-field tabular-nums mt-0.5 font-semibold text-[#2C2C2C]">
                              {pd.versionNumber}
                            </dd>
                          </div>
                        )}

                        {(pd.borderNumber || pd.borderNumberUnknown) && (
                          <div>
                            <dt className="text-xs font-medium text-[#685F58]">
                              {t.hotelBorderLabel}
                            </dt>
                            <dd className="ltr-field tabular-nums mt-0.5 font-semibold text-[#2C2C2C]">
                              {pd.borderNumber || t.statusIncompleteData}
                            </dd>
                          </div>
                        )}

                        <div>
                          <dt className="text-xs font-medium text-[#685F58]">{t.hotelPurposeLabel}</dt>
                          <dd className="mt-0.5 font-semibold text-[#2C2C2C]">{purposeLabel}</dd>
                        </div>

                        <div>
                          <dt className="text-xs font-medium text-[#685F58]">{t.hotelBookingLabel}</dt>
                          <dd className="mt-0.5 font-semibold text-[#2C2C2C]">
                            {bookingLabel}
                            {pd.bookingReference ? (
                              <span className="ltr-field tabular-nums ms-1.5 font-mono text-xs text-[#685F58]">
                                ({pd.bookingReference})
                              </span>
                            ) : null}
                          </dd>
                        </div>
                      </dl>

                      {accompanying.length > 0 && (
                        <div className="mt-4 border-t border-[#2C2C2C]/10 pt-3 text-xs sm:text-sm">
                          <span className="font-semibold text-[#685F58]">
                            {t.hotelCompanionsLabel}{' '}
                          </span>
                          <span className="font-medium text-[#2C2C2C]">
                            {accompanying
                              .map((m) =>
                                [m.fullName, m.relationship, m.documentNumber, m.dateOfBirth]
                                  .filter(Boolean)
                                  .join(' · ')
                              )
                              .join(' | ')}
                          </span>
                        </div>
                      )}

                      {/* Approval Form: Room Number + Mandatory Pricing Box + Welcome Message */}
                      {isPending ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleApproveGuest(session);
                          }}
                          className="mt-5 space-y-3 border-t border-[#2C2C2C]/10 pt-4"
                        >
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                            <div className="sm:col-span-4">
                              <label
                                htmlFor={`room-${session.id}`}
                                className="mb-1 block text-xs font-semibold text-[#2C2C2C]"
                              >
                                {t.hotelRoomInputLabel}
                                <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
                              </label>
                              <input
                                id={`room-${session.id}`}
                                type="text"
                                dir="ltr"
                                required
                                value={roomVal}
                                onChange={(e) => {
                                  const nextRoom = e.target.value;
                                  setRoomInputs((prev) => ({
                                    ...prev,
                                    [session.id]: nextRoom,
                                  }));
                                }}
                                placeholder={t.hotelRoomPlaceholder}
                                maxLength={40}
                                className="ltr-field tabular-nums min-h-[48px] w-full rounded-xl border border-[#2C2C2C]/20 bg-[#FFFFFF] px-3.5 py-2 text-sm font-bold text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                              />
                            </div>

                            <div className="sm:col-span-8">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <label
                                  htmlFor={`welcome-${session.id}`}
                                  className="block text-xs font-semibold text-[#2C2C2C]"
                                >
                                  {t.hotelWelcomeLabel}
                                  <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
                                </label>
                                {welcomeInputs[session.id] !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setWelcomeInputs((prev) => {
                                        const next = { ...prev };
                                        delete next[session.id];
                                        return next;
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-[#8C5338] hover:bg-[#E8A588]/15"
                                  >
                                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                    <span>{t.hotelWelcomeResetTemplate}</span>
                                  </button>
                                )}
                              </div>
                              <textarea
                                id={`welcome-${session.id}`}
                                rows={3}
                                required
                                value={welcomeVal}
                                onChange={(e) =>
                                  setWelcomeInputs((prev) => ({
                                    ...prev,
                                    [session.id]: e.target.value,
                                  }))
                                }
                                placeholder={t.hotelWelcomePlaceholder}
                                maxLength={WELCOME_MESSAGE_MAX_LENGTH}
                                className="min-h-[68px] w-full rounded-xl border border-[#2C2C2C]/20 bg-[#FFFFFF] px-3.5 py-2 text-sm leading-relaxed text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                              />
                              <div className="mt-1 flex justify-end text-[11px] font-medium tabular-nums text-[#685F58]">
                                {welcomeVal.length}/{WELCOME_MESSAGE_MAX_LENGTH}
                              </div>
                            </div>
                          </div>

                          {/* Mandatory Room Pricing Box (Placed under Room Number) */}
                          <div className="rounded-2xl border border-[#C58B6D]/35 bg-[#FFFFFF]/80 p-3.5 sm:p-4">
                            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2C2C2C]">
                                <Banknote className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
                                <span>{t.hotelPricingBoxTitle}</span>
                                <span className="text-[#8C5338]">{t.requiredMark}</span>
                              </span>
                              <span className="text-[11px] font-medium text-[#685F58]">
                                {t.hotelDiscountInternalNote}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div>
                                <label
                                  htmlFor={`room-price-${session.id}`}
                                  className="mb-1 block text-xs font-semibold text-[#2C2C2C]"
                                >
                                  {t.hotelRoomPriceLabel}
                                  <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
                                </label>
                                <input
                                  id={`room-price-${session.id}`}
                                  type="text"
                                  dir="ltr"
                                  inputMode="decimal"
                                  required
                                  value={priceRaw}
                                  onChange={(e) => {
                                    const sanitized = sanitizeDecimalPriceInput(e.target.value);
                                    setPriceInputs((prev) => ({
                                      ...prev,
                                      [session.id]: sanitized,
                                    }));
                                  }}
                                  placeholder={t.hotelRoomPricePlaceholder}
                                  className="ltr-field tabular-nums min-h-[46px] w-full rounded-xl border border-[#2C2C2C]/20 bg-[#FAF7F2] px-3.5 py-2 text-sm font-bold text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`discounted-price-${session.id}`}
                                  className="mb-1 block text-xs font-semibold text-[#2C2C2C]"
                                >
                                  {t.hotelDiscountedPriceLabel}
                                  <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
                                </label>
                                <input
                                  id={`discounted-price-${session.id}`}
                                  type="text"
                                  dir="ltr"
                                  inputMode="decimal"
                                  required
                                  value={discountedRaw}
                                  onChange={(e) => {
                                    const sanitized = sanitizeDecimalPriceInput(e.target.value);
                                    setDiscountedPriceInputs((prev) => ({
                                      ...prev,
                                      [session.id]: sanitized,
                                    }));
                                  }}
                                  placeholder={t.hotelDiscountedPricePlaceholder}
                                  className="ltr-field tabular-nums min-h-[46px] w-full rounded-xl border border-[#2C2C2C]/20 bg-[#FAF7F2] px-3.5 py-2 text-sm font-bold text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                                />
                              </div>

                              <div>
                                <span className="mb-1 block text-xs font-semibold text-[#685F58]">
                                  {t.hotelDiscountPercentLabel}
                                </span>
                                <div className="flex min-h-[46px] items-center justify-between rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-sm font-bold text-[#8C5338]">
                                  <span className="ltr-field tabular-nums">
                                    {autoDiscountPercent !== null
                                      ? `${autoDiscountPercent}%`
                                      : '—'}
                                  </span>
                                  <Percent className="h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
                                </div>
                              </div>
                            </div>

                            {pricingValidationError && (
                              <div
                                role="alert"
                                className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#9E3B33]"
                              >
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{pricingValidationError}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {isConfirmingCancel ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isCancelling || isApproving}
                                    onClick={() => void handleCancelGuestRequest(session.id)}
                                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#9E3B33] px-4 py-2 text-xs font-bold text-[#FAF7F2] transition-colors hover:bg-[#9E3B33]/90 disabled:opacity-50"
                                  >
                                    {isCancelling ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                    <span>
                                      {isCancelling ? t.hotelCancellingButton : t.hotelConfirmCancelButton}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isCancelling}
                                    onClick={() => setConfirmCancelId(null)}
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20 disabled:opacity-50"
                                  >
                                    {t.ownerCancelDelete}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isApproving || isCancelling}
                                  onClick={() => setConfirmCancelId(session.id)}
                                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-4 py-2 text-xs font-bold text-[#9E3B33] transition-colors hover:bg-[#9E3B33]/15 disabled:opacity-45"
                                >
                                  <XCircle className="h-4 w-4" aria-hidden="true" />
                                  <span>{t.hotelCancelRequestButton}</span>
                                </button>
                              )}
                            </div>

                            <button
                              type="submit"
                              disabled={
                                !roomVal.trim() ||
                                !welcomeVal.trim() ||
                                autoDiscountPercent === null ||
                                isApproving ||
                                isCancelling
                              }
                              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                            >
                              {isApproving ? (
                                <Loader2
                                  className="h-4 w-4 animate-spin text-[#E8A588]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Send className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
                              )}
                              <span>
                                {isApproving
                                  ? t.hotelApprovingButton
                                  : t.hotelApproveSendButton}
                              </span>
                            </button>
                          </div>
                        </form>
                      ) : session.status === 'cancelled' ? (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#2C2C2C]/10 pt-3 text-xs text-[#9E3B33]">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            <span>
                              {t.hotelCancelledAtLabel}{' '}
                              <span className="tabular-nums">
                                {formatTime(session.cancelledAt ?? null)}
                              </span>
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3 border-t border-[#2C2C2C]/10 pt-4">
                          {(typeof session.roomPrice === 'number' ||
                            typeof session.discountedPrice === 'number') && (
                            <dl className="grid grid-cols-1 gap-2 rounded-2xl border border-[#2C2C2C]/10 bg-[#FFFFFF] p-3 text-xs sm:grid-cols-3 sm:text-sm">
                              {typeof session.roomPrice === 'number' && (
                                <div>
                                  <dt className="text-xs font-medium text-[#685F58]">
                                    {t.hotelRoomPriceLabel}
                                  </dt>
                                  <dd className="tabular-nums mt-0.5 font-bold text-[#2C2C2C]">
                                    {formatCurrencyPrice(session.roomPrice, lang)}
                                  </dd>
                                </div>
                              )}
                              {typeof session.discountedPrice === 'number' && (
                                <div>
                                  <dt className="text-xs font-medium text-[#685F58]">
                                    {t.hotelDiscountedPriceLabel}
                                  </dt>
                                  <dd className="tabular-nums mt-0.5 font-bold text-[#2E6B47]">
                                    {formatCurrencyPrice(session.discountedPrice, lang)}
                                  </dd>
                                </div>
                              )}
                              {typeof session.discountPercent === 'number' && (
                                <div>
                                  <dt className="text-xs font-medium text-[#685F58]">
                                    {t.hotelDiscountPercentLabel}
                                  </dt>
                                  <dd className="ltr-field tabular-nums mt-0.5 font-bold text-[#8C5338]">
                                    {session.discountPercent}%
                                  </dd>
                                </div>
                              )}
                            </dl>
                          )}

                          {editingWelcomeSessionId === session.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleSaveEditedWelcome(session.id);
                              }}
                              className="space-y-2.5 rounded-2xl border border-[#C58B6D]/35 bg-[#FFFFFF] p-3.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <label
                                  htmlFor={`edit-welcome-${session.id}`}
                                  className="text-xs font-bold text-[#2C2C2C]"
                                >
                                  {t.approvedWelcomeLabel}
                                </label>
                                <span className="text-[11px] font-medium tabular-nums text-[#685F58]">
                                  {(editingWelcomeDrafts[session.id] ?? '').length}/
                                  {WELCOME_MESSAGE_MAX_LENGTH}
                                </span>
                              </div>
                              <textarea
                                id={`edit-welcome-${session.id}`}
                                rows={3}
                                required
                                value={editingWelcomeDrafts[session.id] ?? ''}
                                onChange={(e) =>
                                  setEditingWelcomeDrafts((prev) => ({
                                    ...prev,
                                    [session.id]: e.target.value,
                                  }))
                                }
                                placeholder={t.hotelWelcomePlaceholder}
                                maxLength={WELCOME_MESSAGE_MAX_LENGTH}
                                className="w-full rounded-xl border border-[#2C2C2C]/20 bg-[#FAF7F2] px-3.5 py-2 text-sm leading-relaxed text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
                              />
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={savingWelcomeSessionId === session.id}
                                  onClick={() => {
                                    setEditingWelcomeSessionId(null);
                                    setEditingWelcomeDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[session.id];
                                      return next;
                                    });
                                  }}
                                  className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20 disabled:opacity-50"
                                >
                                  {t.hotelCancelEditWelcomeButton}
                                </button>
                                <button
                                  type="submit"
                                  disabled={
                                    savingWelcomeSessionId === session.id ||
                                    !(editingWelcomeDrafts[session.id] ?? '').trim()
                                  }
                                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#2C2C2C] px-4 py-1.5 text-xs font-bold text-[#FAF7F2] hover:bg-[#2C2C2C]/90 disabled:opacity-45"
                                >
                                  {savingWelcomeSessionId === session.id ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 animate-spin text-[#E8A588]"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Save className="h-3.5 w-3.5 text-[#E8A588]" aria-hidden="true" />
                                  )}
                                  <span>
                                    {savingWelcomeSessionId === session.id
                                      ? t.hotelSavingWelcomeButton
                                      : t.hotelSaveWelcomeButton}
                                  </span>
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="rounded-xl bg-[#F4EFEA] px-3.5 py-2.5 text-sm text-[#2C2C2C]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-[#685F58]">
                                  {t.approvedWelcomeLabel}:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingWelcomeSessionId(session.id);
                                    setEditingWelcomeDrafts((prev) => ({
                                      ...prev,
                                      [session.id]: session.welcomeMessage ?? '',
                                    }));
                                  }}
                                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#2C2C2C]/15 bg-[#FFFFFF] px-2.5 py-1 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/15"
                                >
                                  <Pencil className="h-3 w-3" aria-hidden="true" />
                                  <span>{t.hotelEditWelcomeButton}</span>
                                </button>
                              </div>
                              {session.welcomeMessage && (
                                <p className="m-0 mt-1.5 whitespace-pre-line leading-relaxed">
                                  {session.welcomeMessage}
                                </p>
                              )}
                            </div>
                          )}

                          {guestWhatsAppUrl && (
                            <a
                              href={guestWhatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-4 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
                            >
                              <MessageCircle
                                className="h-4 w-4 text-[#2E6B47]"
                                aria-hidden="true"
                              />
                              <span>{t.hotelSendWhatsAppGuest}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
