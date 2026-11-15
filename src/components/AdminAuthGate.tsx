import { useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { Loader2, LogIn, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { auth, googleProvider, isUserAuthorizedAdmin } from '../lib/firebase';
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
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
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
      <section className="mx-auto max-w-md rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C58B6D]/30 bg-[#E8A588]/20 text-[#8C5338]">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[#2C2C2C]">{t.adminGateTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#685F58]">{t.adminGateDesc}</p>

        {authError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 px-3.5 py-2.5 text-xs font-medium text-[#9E3B33]"
          >
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={signingIn}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2C2C2C] px-5 py-3 text-sm font-bold text-[#FAF7F2] transition-all hover:bg-[#2C2C2C]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] disabled:opacity-60"
        >
          {signingIn ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#E8A588]" aria-hidden="true" />
          ) : (
            <LogIn className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
          )}
          <span>{signingIn ? t.adminSigningIn : t.adminSignInButton}</span>
        </button>
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
