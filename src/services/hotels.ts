import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  HotelPrivateInfo,
  HotelRecord,
  HotelStatus,
  HotelWithPrivate,
} from '../types/guest';
import { normalizeHotelPhoneToWhatsApp } from '../utils/documentRules';

export const HOTELS_COLLECTION = 'hotels';

export const DEFAULT_HOTEL_TERMS_AR = `1. الالتزام بمواعيد تسجيل الدخول والمغادرة المعتمدة لدى الفندق.
2. إبراز أصل الهوية الوطنية أو الإقامة أو جواز السفر عند الاستقبال لمطابقة البيانات.
3. المحافظة على الهدوء العام ومرافق الغرفة وعدم إتلاف الممتلكات.
4. يُمنع التدخين داخل الغرف غير المخصصة للتدخين وفق أنظمة الفندق.
5. يتحمل النزيل مسؤولية المرافقين والالتزام بسياسات الإلغاء والتمديد المعتمدة.`;

export const DEFAULT_HOTEL_TERMS_EN = `1. Guests must adhere to the hotel's standard check-in and check-out times.
2. Original National ID, Iqama, or Passport must be presented at reception for verification.
3. Guests are expected to maintain quiet hours and take care of room furnishings and hotel property.
4. Smoking is prohibited inside non-smoking rooms in accordance with hotel regulations.
5. The primary guest is responsible for accompanying guests and adhering to extension and cancellation policies.`;

function parseTimestamp(raw: unknown): Date | null {
  if (raw instanceof Timestamp) return raw.toDate();
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: unknown }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate();
  }
  return null;
}

function mapSnapshotToHotel(id: string, data: DocumentData): HotelRecord {
  const statusRaw = data.status;
  const status: HotelStatus =
    statusRaw === 'approved' || statusRaw === 'suspended' ? statusRaw : 'pending';
  return {
    id: typeof data.id === 'string' ? data.id : id,
    name: typeof data.name === 'string' ? data.name : '',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    status,
    isActive: data.isActive === true,
    expiresAt: parseTimestamp(data.expiresAt),
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt),
    termsText: typeof data.termsText === 'string' ? data.termsText : '',
  };
}

function mapPrivateInfo(data: DocumentData | undefined): Partial<HotelPrivateInfo> {
  if (!data) return {};
  return {
    email: typeof data.email === 'string' ? data.email : '',
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : '',
    receptionPhone: typeof data.receptionPhone === 'string' ? data.receptionPhone : '',
  };
}

function generateHotelId(): string {
  const timePart = Date.now().toString(36);
  const randPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  return `hotel_${timePart}_${randPart}`;
}

export async function registerHotel(params: {
  name: string;
  receptionPhone: string;
  email: string;
  ownerUid: string;
  ownerEmail: string;
  termsText?: string;
}): Promise<HotelWithPrivate> {
  const cleanName = params.name.trim().slice(0, 150);
  if (!cleanName) {
    throw new Error('Hotel name is required.');
  }

  const normalizedPhone = normalizeHotelPhoneToWhatsApp(params.receptionPhone);
  if (normalizedPhone.length < 7 || normalizedPhone.length > 25) {
    throw new Error('Valid reception mobile number is required (7-25 digits).');
  }

  const cleanEmail = params.email.trim().slice(0, 200);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Valid email address is required.');
  }

  const cleanOwnerEmail = params.ownerEmail.trim().slice(0, 200) || cleanEmail;
  const cleanTermsText = (params.termsText ?? '').trim().slice(0, 4000);
  const id = generateHotelId();
  const path = `${HOTELS_COLLECTION}/${id}`;

  const hotelPayload = {
    id,
    name: cleanName,
    ownerUid: params.ownerUid,
    status: 'pending' as const,
    isActive: false,
    expiresAt: null,
    termsText: cleanTermsText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const privatePayload = {
    hotelId: id,
    ownerUid: params.ownerUid,
    email: cleanEmail,
    ownerEmail: cleanOwnerEmail,
    receptionPhone: normalizedPhone,
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, HOTELS_COLLECTION, id), hotelPayload);
    batch.set(doc(db, HOTELS_COLLECTION, id, 'private', 'info'), privatePayload);
    await batch.commit();

    return {
      id,
      name: cleanName,
      ownerUid: params.ownerUid,
      status: 'pending',
      isActive: false,
      expiresAt: null,
      termsText: cleanTermsText,
      createdAt: new Date(),
      updatedAt: new Date(),
      email: cleanEmail,
      ownerEmail: cleanOwnerEmail,
      receptionPhone: normalizedPhone,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function hydrateHotelsWithPrivateInfo(
  hotels: HotelRecord[]
): Promise<HotelWithPrivate[]> {
  const results = await Promise.all(
    hotels.map(async (hotel) => {
      try {
        const privSnap = await getDoc(
          doc(db, HOTELS_COLLECTION, hotel.id, 'private', 'info')
        );
        const priv = mapPrivateInfo(privSnap.exists() ? privSnap.data() : undefined);
        return {
          ...hotel,
          email: priv.email,
          ownerEmail: priv.ownerEmail,
          receptionPhone: priv.receptionPhone,
        };
      } catch {
        return hotel;
      }
    })
  );
  return results;
}

export function subscribeToOwnerHotels(
  ownerUid: string,
  onData: (hotels: HotelWithPrivate[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, HOTELS_COLLECTION), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snapshot) => {
      const baseList = snapshot.docs
        .map((d) => mapSnapshotToHotel(d.id, d.data()))
        .sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? Date.now();
          const tb = b.createdAt?.getTime() ?? Date.now();
          return tb - ta;
        });

      void hydrateHotelsWithPrivateInfo(baseList).then((hydrated) => {
        onData(hydrated);
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, HOTELS_COLLECTION);
    }
  );
}

export function subscribeToAllHotelsForAdmin(
  onData: (hotels: HotelWithPrivate[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, HOTELS_COLLECTION),
    (snapshot) => {
      const baseList = snapshot.docs
        .map((d) => mapSnapshotToHotel(d.id, d.data()))
        .sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? Date.now();
          const tb = b.createdAt?.getTime() ?? Date.now();
          return tb - ta;
        });

      void hydrateHotelsWithPrivateInfo(baseList).then((hydrated) => {
        onData(hydrated);
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, HOTELS_COLLECTION);
    }
  );
}

export function subscribeToHotelById(
  hotelId: string,
  onData: (hotel: HotelRecord | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  return onSnapshot(
    doc(db, HOTELS_COLLECTION, hotelId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(mapSnapshotToHotel(snapshot.id, snapshot.data()));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function approveOrRenewHotel(
  hotelId: string,
  durationDays: number,
  currentExpiresAt?: Date | null
): Promise<void> {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  const now = new Date();
  const baseDate =
    currentExpiresAt && currentExpiresAt.getTime() > now.getTime()
      ? currentExpiresAt
      : now;
  const nextExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

  try {
    await updateDoc(doc(db, HOTELS_COLLECTION, hotelId), {
      status: 'approved',
      isActive: true,
      expiresAt: Timestamp.fromDate(nextExpiry),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function suspendHotel(hotelId: string): Promise<void> {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  try {
    await updateDoc(doc(db, HOTELS_COLLECTION, hotelId), {
      status: 'suspended',
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reactivateHotel(hotelId: string): Promise<void> {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  try {
    await updateDoc(doc(db, HOTELS_COLLECTION, hotelId), {
      status: 'approved',
      isActive: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateHotelTerms(
  hotelId: string,
  termsText: string
): Promise<void> {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  const cleanTerms = termsText.trim().slice(0, 4000);
  try {
    await updateDoc(doc(db, HOTELS_COLLECTION, hotelId), {
      termsText: cleanTerms,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHotel(hotelId: string): Promise<void> {
  const path = `${HOTELS_COLLECTION}/${hotelId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, HOTELS_COLLECTION, hotelId, 'private', 'info'));
    batch.delete(doc(db, HOTELS_COLLECTION, hotelId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
