import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  formatFirebaseAuthError,
  isUserAuthorizedAdmin,
  refreshCurrentUser,
  resetHotelPassword,
  sendCurrentUserVerificationEmail,
  signInHotelWithEmail,
} from '../lib/firebase';
import type { TranslationKeys } from '../i18n/ar';

interface AdminAuthGateProps {
  t: TranslationKeys;
  children: (user: User, handleSignOut: () => Promise<void>) => ReactNode;
}

export function AdminAuthGate({ t, children }: AdminAuthGateProps) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [refreshingVerify, setRefreshingVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setIsAuthorized(false);
        setCheckingRole(false);
        return;
      }
      setCheckingRole(true);
      try {
        const ok = await isUserAuthorizedAdmin(nextUser);
        if (active) {
          setIsAuthorized(ok);
        }
      } catch {
        if (active) {
          setIsAuthorized(false);
        }
      } finally {
        if (active) {
          setCheckingRole(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSent(false);

    const cleanEmail = authEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError(t.hotelErrEmailInvalid);
      return;
    }
    if (!authPassword) {
      setAuthError(t.hotelAuthErrPasswordShort);
      return;
    }

    setSigningIn(true);
    try {
      await signInHotelWithEmail(cleanEmail, authPassword);
      setAuthPassword('');
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted) {
        setAuthError(formatted);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleResetOrSetPassword = async () => {
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

  const handleSendVerification = async () => {
    setSendingVerify(true);
    setVerifyError(null);
    setVerifySent(false);
    try {
      await sendCurrentUserVerificationEmail();
      setVerifySent(true);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      setVerifyError(formatted ?? 'Failed to send verification email.');
    } finally {
      setSendingVerify(false);
    }
  };

  const handleRefreshVerification = async () => {
    setRefreshingVerify(true);
    setVerifyError(null);
    try {
      const updated = await refreshCurrentUser();
      setUser(updated);
      if (!updated?.emailVerified) {
        setVerifyError(t.adminNotVerifiedYet);
        return;
      }
      const ok = await isUserAuthorizedAdmin(updated);
      setIsAuthorized(ok);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      setVerifyError(formatted ?? t.adminNotVerifiedYet);
    } finally {
      setRefreshingVerify(false);
    }
  };

  const handleSignOut = async () => {
    setVerifySent(false);
    setVerifyError(null);
    await signOut(auth);
  };

  if (!authReady || checkingRole) {
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
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-[#2C2C2C]">{t.adminGateTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#685F58]">{t.adminGateDesc}</p>
        </div>

        <form onSubmit={handleEmailSignIn} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-auth-email"
              className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
            >
              {t.hotelAuthEmailLabel}
              <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
            </label>
            <input
              id="admin-auth-email"
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
              htmlFor="admin-auth-password"
              className="mb-1.5 block text-sm font-semibold text-[#2C2C2C]"
            >
              {t.hotelAuthPasswordLabel}
              <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>
            </label>
            <div className="relative">
              <input
                id="admin-auth-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
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
            ) : (
              <LogIn className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
            )}
            <span>{signingIn ? t.adminSigningIn : t.adminSignInButton}</span>
          </button>

          <div className="text-center">
            <button
              type="button"
              disabled={sendingReset}
              onClick={handleResetOrSetPassword}
              className="inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-xs font-semibold text-[#8C5338] hover:underline disabled:opacity-50"
            >
              {sendingReset ? '...' : t.adminSetOrResetPassword}
            </button>
          </div>
        </form>
      </section>
    );
  }

  // Bootstrapped owner signed in with Email/Password before email verification completed
  if (
    !isAuthorized &&
    !user.emailVerified &&
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  ) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-[#C58B6D]/40 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C58B6D]/30 bg-[#E8A588]/20 text-[#8C5338]">
          <MailCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[#2C2C2C]">{t.adminVerifyTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#685F58]">{t.adminVerifyDesc}</p>
        {user.email && (
          <p className="mt-3 text-xs text-[#685F58]">
            <span>{t.adminSignedInAs} </span>
            <span className="ltr-field font-semibold text-[#2C2C2C]">{user.email}</span>
          </p>
        )}

        {verifySent && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#2E6B47]/30 bg-[#2E6B47]/10 px-3.5 py-2.5 text-start text-xs font-medium text-[#2E6B47]"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t.adminVerifySent}</span>
          </div>
        )}

        {verifyError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-3.5 py-2.5 text-start text-xs font-medium text-[#9E3B33]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{verifyError}</span>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={sendingVerify}
            onClick={handleSendVerification}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-5 py-3 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 disabled:opacity-60"
          >
            {sendingVerify ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
            ) : (
              <MailCheck className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
            )}
            <span>
              {sendingVerify ? t.adminSendingVerifyButton : t.adminSendVerifyButton}
            </span>
          </button>

          <button
            type="button"
            disabled={refreshingVerify}
            onClick={handleRefreshVerification}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#E8A588]/20 disabled:opacity-60"
          >
            {refreshingVerify ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#8C5338]" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
            )}
            <span>
              {refreshingVerify ? t.adminRefreshingVerifyButton : t.adminRefreshVerifyButton}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-4 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>{t.adminSignOutButton}</span>
          </button>
        </div>
      </section>
    );
  }

  if (!isAuthorized) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-[#9E3B33]/25 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#9E3B33]/25 bg-[#9E3B33]/10 text-[#9E3B33]">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[#2C2C2C]">{t.adminUnauthorizedTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#685F58]">{t.adminUnauthorizedDesc}</p>
        {user.email && (
          <p className="mt-3 text-xs text-[#685F58]">
            <span>{t.adminSignedInAs} </span>
            <span className="ltr-field font-semibold text-[#2C2C2C]">{user.email}</span>
          </p>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-5 py-2.5 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/20"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t.adminSignOutButton}</span>
        </button>
      </section>
    );
  }

  return <>{children(user, handleSignOut)}</>;
}

