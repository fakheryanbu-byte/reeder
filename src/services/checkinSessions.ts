import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  CheckinPassportData,
  CheckinSessionRecord,
  CheckinSessionStatus,
  GuestFormData,
  HotelRecord,
} from '../types/guest';
import {
  buildCheckinPassportData,
  calculateDiscountPercent,
  WELCOME_MESSAGE_MAX_LENGTH,
} from '../utils/documentRules';

export const CHECKIN_SESSIONS_COLLECTION = 'checkin_sessions';

function parseTimestamp(raw: unknown): Date | null {
  if (raw instanceof Timestamp) {
    return raw.toDate();
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: unknown }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function mapSnapshotToSession(id: string, data: DocumentData): CheckinSessionRecord {
  return {
    id: typeof data.id === 'string' ? data.id : id,
    hotelId: typeof data.hotelId === 'string' ? data.hotelId : '',
    hotelName: typeof data.hotelName === 'string' ? data.hotelName : '',
    hotelOwnerUid: typeof data.hotelOwnerUid === 'string' ? data.hotelOwnerUid : '',
    guestName: typeof data.guestName === 'string' ? data.guestName : '',
    nationality: typeof data.nationality === 'string' ? data.nationality : '',
    passportData: (data.passportData ?? {}) as CheckinPassportData,
    status: (data.status === 'approved'
      ? 'approved'
      : data.status === 'cancelled'
        ? 'cancelled'
        : 'pending') as CheckinSessionStatus,
    roomNumber: typeof data.roomNumber === 'string' ? data.roomNumber : null,
    welcomeMessage: typeof data.welcomeMessage === 'string' ? data.welcomeMessage : null,
    roomPrice: typeof data.roomPrice === 'number' ? data.roomPrice : null,
    discountedPrice: typeof data.discountedPrice === 'number' ? data.discountedPrice : null,
    discountPercent: typeof data.discountPercent === 'number' ? data.discountPercent : null,
    createdAt: parseTimestamp(data.createdAt),
    approvedAt: parseTimestamp(data.approvedAt),
    cancelledAt: parseTimestamp(data.cancelledAt),
  };
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 12);
  return `sess_${Date.now()}_${rand}`;
}

export async function createCheckinSession(
  form: GuestFormData,
  hotel: HotelRecord
): Promise<string> {
  const sessionId = generateSessionId();
  const path = `${CHECKIN_SESSIONS_COLLECTION}/${sessionId}`;

  const payload = {
    id: sessionId,
    hotelId: hotel.id,
    hotelName: hotel.name,
    hotelOwnerUid: hotel.ownerUid,
    guestName: form.fullName.trim().slice(0, 200),
    nationality: form.nationality.trim().slice(0, 120),
    passportData: buildCheckinPassportData(form),
    status: 'pending' as const,
    roomNumber: null,
    welcomeMessage: null,
    roomPrice: null,
    discountedPrice: null,
    discountPercent: null,
    createdAt: serverTimestamp(),
    approvedAt: null,
  };

  try {
    await setDoc(doc(db, CHECKIN_SESSIONS_COLLECTION, sessionId), payload);
    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToCheckinSession(
  sessionId: string,
  onUpdate: (session: CheckinSessionRecord | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const path = `${CHECKIN_SESSIONS_COLLECTION}/${sessionId}`;
  return onSnapshot(
    doc(db, CHECKIN_SESSIONS_COLLECTION, sessionId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapSnapshotToSession(snapshot.id, snapshot.data()));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToHotelCheckinSessions(
  hotelId: string,
  hotelOwnerUid: string,
  onData: (sessions: CheckinSessionRecord[], newlyAddedPendingIds: string[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  let isInitialSnapshot = true;
  const q = query(
    collection(db, CHECKIN_SESSIONS_COLLECTION),
    where('hotelOwnerUid', '==', hotelOwnerUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs
        .map((d) => mapSnapshotToSession(d.id, d.data()))
        .filter((s) => s.hotelId === hotelId)
        .sort((a, b) => {
          const timeA = a.createdAt?.getTime() ?? Date.now();
          const timeB = b.createdAt?.getTime() ?? Date.now();
          return timeB - timeA;
        });

      const newlyAddedPendingIds: string[] = [];
      if (!isInitialSnapshot) {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.hotelId === hotelId && data.status === 'pending') {
              newlyAddedPendingIds.push(change.doc.id);
            }
          }
        }
      }
      isInitialSnapshot = false;
      onData(sessions, newlyAddedPendingIds);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, CHECKIN_SESSIONS_COLLECTION);
    }
  );
}

export async function approveCheckinSession(
  sessionId: string,
  roomNumber: string,
  welcomeMessage: string,
  roomPrice: number,
  discountedPrice: number
): Promise<void> {
  const trimmedRoom = roomNumber.trim().slice(0, 40);
  if (!trimmedRoom) {
    throw new Error('Room number is required.');
  }
  const trimmedWelcome = welcomeMessage.trim().slice(0, WELCOME_MESSAGE_MAX_LENGTH);
  if (!trimmedWelcome) {
    throw new Error('Welcome message is required.');
  }
  const cleanRoomPrice = Math.round(roomPrice * 100) / 100;
  const cleanDiscountedPrice = Math.round(discountedPrice * 100) / 100;
  const discountPercent = calculateDiscountPercent(cleanRoomPrice, cleanDiscountedPrice);
  if (discountPercent === null) {
    throw new Error('Valid room price and discounted price are required.');
  }

  const path = `${CHECKIN_SESSIONS_COLLECTION}/${sessionId}`;
  try {
    await updateDoc(doc(db, CHECKIN_SESSIONS_COLLECTION, sessionId), {
      roomNumber: trimmedRoom,
      welcomeMessage: trimmedWelcome,
      roomPrice: cleanRoomPrice,
      discountedPrice: cleanDiscountedPrice,
      discountPercent,
      status: 'approved',
      approvedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateApprovedWelcomeMessage(
  sessionId: string,
  welcomeMessage: string
): Promise<void> {
  const trimmedWelcome = welcomeMessage.trim().slice(0, WELCOME_MESSAGE_MAX_LENGTH);
  if (!trimmedWelcome) {
    throw new Error('Welcome message is required.');
  }

  const path = `${CHECKIN_SESSIONS_COLLECTION}/${sessionId}`;
  try {
    await updateDoc(doc(db, CHECKIN_SESSIONS_COLLECTION, sessionId), {
      welcomeMessage: trimmedWelcome,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelCheckinSession(sessionId: string): Promise<void> {
  const path = `${CHECKIN_SESSIONS_COLLECTION}/${sessionId}`;
  try {
    await updateDoc(doc(db, CHECKIN_SESSIONS_COLLECTION, sessionId), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
