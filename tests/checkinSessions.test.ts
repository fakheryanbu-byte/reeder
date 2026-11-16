import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateDocMock = vi.fn();
const docMock = vi.fn((_db: unknown, col: string, id: string) => ({ col, id }));
const serverTimestampMock = vi.fn(() => ({ __serverTimestamp: true }));
const onSnapshotMock = vi.fn();
const setDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (...args: unknown[]) => docMock(args[0], String(args[1]), String(args[2])),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  query: vi.fn(),
  serverTimestamp: () => serverTimestampMock(),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  Timestamp: class MockTimestamp {
    private d: Date;
    constructor(d: Date) {
      this.d = d;
    }
    toDate() {
      return this.d;
    }
  },
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  where: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: { __mockDb: true },
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  },
  handleFirestoreError: vi.fn((err: unknown) => {
    throw err instanceof Error ? err : new Error(String(err));
  }),
}));

import {
  approveCheckinSession,
  cancelCheckinSession,
  subscribeToCheckinSession,
} from '../src/services/checkinSessions';
import type { CheckinSessionRecord } from '../src/types/guest';

describe('checkinSessions service', () => {
  beforeEach(() => {
    updateDocMock.mockReset();
    onSnapshotMock.mockReset();
    docMock.mockClear();
    serverTimestampMock.mockClear();
  });

  it('sends exact approval fields and discount percentage via approveCheckinSession', async () => {
    updateDocMock.mockResolvedValueOnce(undefined);

    await approveCheckinSession(
      '5b141655-f85e-49c4-94a6-3c45024fd167',
      ' 98 ',
      ' مرحباً بك ',
      200,
      80
    );

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const [ref, payload] = updateDocMock.mock.calls[0];
    expect(ref).toEqual({
      col: 'checkin_sessions',
      id: '5b141655-f85e-49c4-94a6-3c45024fd167',
    });
    expect(payload).toEqual({
      roomNumber: '98',
      welcomeMessage: 'مرحباً بك',
      roomPrice: 200,
      discountedPrice: 80,
      discountPercent: 60,
      status: 'approved',
      approvedAt: { __serverTimestamp: true },
    });
  });

  it('sends exact cancellation payload via cancelCheckinSession', async () => {
    updateDocMock.mockResolvedValueOnce(undefined);

    await cancelCheckinSession('5b141655-f85e-49c4-94a6-3c45024fd167');

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const [ref, payload] = updateDocMock.mock.calls[0];
    expect(ref).toEqual({
      col: 'checkin_sessions',
      id: '5b141655-f85e-49c4-94a6-3c45024fd167',
    });
    expect(payload).toEqual({
      status: 'cancelled',
      cancelledAt: { __serverTimestamp: true },
    });
  });

  it('maps cancelled status and cancelledAt timestamp in subscribeToCheckinSession', () => {
    const cancelledDate = new Date('2026-11-16T18:10:00Z');
    const createdDate = new Date('2026-11-16T18:01:18Z');
    const captured: { value: CheckinSessionRecord | null } = { value: null };

    onSnapshotMock.mockImplementationOnce((_ref, onNext: (snap: unknown) => void) => {
      onNext({
        exists: () => true,
        id: 'sess-123',
        data: () => ({
          id: 'sess-123',
          hotelId: 'hotel_1',
          hotelName: 'فندق فخر ينبع',
          hotelOwnerUid: 'uid-1',
          guestName: 'نزيل تجريبي',
          nationality: 'سعودي',
          passportData: {},
          status: 'cancelled',
          roomNumber: null,
          welcomeMessage: null,
          roomPrice: null,
          discountedPrice: null,
          discountPercent: null,
          createdAt: { toDate: () => createdDate },
          approvedAt: null,
          cancelledAt: { toDate: () => cancelledDate },
        }),
      });
      return vi.fn();
    });

    subscribeToCheckinSession('sess-123', (session) => {
      captured.value = session;
    });

    expect(captured.value).not.toBeNull();
    expect(captured.value?.status).toBe('cancelled');
    expect(captured.value?.cancelledAt?.toISOString()).toBe(cancelledDate.toISOString());
    expect(captured.value?.createdAt?.toISOString()).toBe(createdDate.toISOString());
  });
});
