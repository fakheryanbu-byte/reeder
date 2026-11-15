import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw err;
  }
}

export async function signInHotelWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerHotelWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetHotelPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function sendCurrentUserVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Not signed in.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function refreshCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export function formatFirebaseAuthError(err: unknown): string | null {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const rawMsg = err instanceof Error ? err.message : String(err ?? '');

  if (code === 'auth/popup-closed-by-user' || rawMsg.includes('popup-closed-by-user')) {
    return null;
  }

  const isEn =
    typeof document !== 'undefined' && document.documentElement.lang === 'en';
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
    if (isEn) {
      return `This domain (${currentHost}) is not authorized in Firebase Authentication yet. Add "${currentHost}" in Firebase Console → Authentication → Settings → Authorized domains (Project: ${firebaseConfig.projectId}).`;
    }
    return `هذا النطاق (${currentHost}) غير مضاف في النطاقات المصرح بها داخل Firebase. افتح Firebase Console ← Authentication ← Settings ← Authorized domains للمشروع (${firebaseConfig.projectId}) وأضف النطاق: ${currentHost}`;
  }

  if (code === 'auth/operation-not-allowed') {
    return isEn
      ? 'Email/Password sign-in is not enabled yet in Firebase Console → Authentication → Sign-in method.'
      : 'تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّل بعد في Firebase Console ← Authentication ← Sign-in method.';
  }

  if (code === 'auth/email-already-in-use') {
    return isEn
      ? 'This email is already registered. Please sign in instead.'
      : 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى اختيار تسجيل الدخول.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return isEn
      ? 'Incorrect email or password.'
      : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  }

  if (code === 'auth/weak-password') {
    return isEn
      ? 'Password is too weak. Please enter at least 6 characters.'
      : 'كلمة المرور قصيرة جداً؛ يجب أن تتكون من 6 أحرف أو أرقام على الأقل.';
  }

  if (code === 'auth/invalid-email') {
    return isEn
      ? 'Please enter a valid email address.'
      : 'يرجى إدخال بريد إلكتروني صحيح.';
  }

  if (code === 'auth/too-many-requests') {
    return isEn
      ? 'Too many attempts. Please wait a moment and try again.'
      : 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
  }

  if (code === 'auth/network-request-failed') {
    return isEn
      ? 'Network error. Please check your internet connection.'
      : 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
  }

  return rawMsg || (isEn ? 'Sign-in failed.' : 'تعذر تسجيل الدخول.');
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'fakheryanbu@gmail.com';

export async function isUserAuthorizedAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
    return true;
  }
  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    return adminDoc.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
