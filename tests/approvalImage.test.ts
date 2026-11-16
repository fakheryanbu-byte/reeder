import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildApprovalImageFilename,
  renderApprovalCardPng,
  saveApprovalImageToDevice,
  wrapTextToLines,
  type ApprovalImageParams,
} from '../src/utils/approvalImage';

function createSampleParams(overrides: Partial<ApprovalImageParams> = {}): ApprovalImageParams {
  return {
    hotelName: 'فندق لؤلؤة البحر',
    guestName: 'أحمد محمد العتيبي',
    roomNumber: '204',
    welcomeMessage: 'مرحباً بك في الفندق، نتمنى لك إقامة سعيدة.',
    guestVisiblePrice: 450,
    sessionId: '40e211b7-1f09-4c45-8452-aff8d308452b',
    approvedAt: new Date('2026-11-16T15:30:00Z'),
    lang: 'ar',
    labels: {
      approvedTitle: 'تمت الموافقة وتأكيد تسجيل الدخول',
      approvedRoomLabel: 'رقم الغرفة المخصص لك',
      approvedPriceLabel: 'سعر الغرفة',
      approvedWelcomeLabel: 'رسالة الترحيب من الفندق',
      guestLabel: 'اسم النزيل',
      sessionLabel: 'رقم الطلب',
    },
    ...overrides,
  };
}

function setupMockDomForCanvas() {
  const drawnTexts: string[] = [];
  const clickedAnchors: Array<{ href: string; download: string }> = [];
  const revokedUrls: string[] = [];

  const mockCtx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn((s: string) => ({ width: s.length * 10 })),
    fillText: vi.fn((text: string) => {
      drawnTexts.push(text);
    }),
  };

  const mockBlob = new Blob(['png-bytes'], { type: 'image/png' });

  const createElement = vi.fn((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(mockBlob)),
      };
    }
    if (tag === 'a') {
      const anchor = {
        href: '',
        download: '',
        click: vi.fn(() => {
          clickedAnchors.push({ href: anchor.href, download: anchor.download });
        }),
      };
      return anchor;
    }
    return {};
  });

  const appendChild = vi.fn();
  const removeChild = vi.fn();

  vi.stubGlobal('document', {
    fonts: { ready: Promise.resolve() },
    createElement,
    body: { appendChild, removeChild },
  });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-approval-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    revokedUrls.push(url);
  });

  return { drawnTexts, clickedAnchors, revokedUrls, mockBlob };
}

describe('approvalImage helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds a clean PNG filename from room number (including Arabic numerals) and session ID', () => {
    expect(
      buildApprovalImageFilename('204', '40e211b7-1f09-4c45-8452-aff8d308452b')
    ).toBe('checkin-approval-room-204-40e211b7.png');

    expect(buildApprovalImageFilename('A / 12', 'sess_123456789')).toBe(
      'checkin-approval-room-A-12-sess_123.png'
    );

    expect(buildApprovalImageFilename('٢٠٤', 'abcd1234')).toBe(
      'checkin-approval-room-204-abcd1234.png'
    );

    expect(buildApprovalImageFilename('', '')).toBe('checkin-approval.png');
  });

  it('wraps long multi-paragraph text and unbroken tokens within maxWidth', () => {
    const measure = (s: string) => s.length * 10;
    const lines = wrapTextToLines(
      'مرحباً بك في الفندق\r\n\r\nنتمنى لك إقامة سعيدة ومريحة معنا طوال فترة زيارتك',
      180,
      measure
    );

    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines).toContain('');
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(180);
    }

    const tokenLines = wrapTextToLines('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 80, measure);
    expect(tokenLines).toEqual(['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZ']);
  });

  it('renders PNG blob containing room number, hotel name, guest name, price, and welcome message', async () => {
    const { drawnTexts, mockBlob } = setupMockDomForCanvas();

    const blob = await renderApprovalCardPng(createSampleParams());
    expect(blob).toBe(mockBlob);
    expect(blob.type).toBe('image/png');
    expect(drawnTexts).toContain('204');
    expect(drawnTexts).toContain('فندق لؤلؤة البحر');
    expect(drawnTexts.some((t) => t.includes('أحمد محمد العتيبي'))).toBe(true);
    expect(drawnTexts.some((t) => t.includes('450'))).toBe(true);
    expect(drawnTexts.some((t) => t.includes('مرحباً بك'))).toBe(true);
  });

  it('triggers direct PNG download on desktop browsers', async () => {
    const { clickedAnchors } = setupMockDomForCanvas();
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    const result = await saveApprovalImageToDevice(createSampleParams());
    expect(result).toBe('downloaded');
    expect(clickedAnchors).toEqual([
      {
        href: 'blob:mock-approval-url',
        download: 'checkin-approval-room-204-40e211b7.png',
      },
    ]);
  });

  it('uses Web Share API on mobile when supported and handles user cancellation gracefully', async () => {
    const { clickedAnchors } = setupMockDomForCanvas();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      canShare: vi.fn(() => true),
      share: shareMock,
    });

    const sharedResult = await saveApprovalImageToDevice(createSampleParams());
    expect(sharedResult).toBe('shared');
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(clickedAnchors).toHaveLength(0);

    const abortErr = new Error('User cancelled');
    abortErr.name = 'AbortError';
    shareMock.mockRejectedValueOnce(abortErr);

    const cancelledResult = await saveApprovalImageToDevice(createSampleParams());
    expect(cancelledResult).toBe('cancelled');
    expect(clickedAnchors).toHaveLength(0);
  });
});
