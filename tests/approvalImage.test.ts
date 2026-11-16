import { describe, expect, it } from 'vitest';
import {
  buildApprovalImageFilename,
  wrapTextToLines,
} from '../src/utils/approvalImage';

describe('approvalImage helpers', () => {
  it('builds a clean PNG filename from room number and session ID', () => {
    expect(
      buildApprovalImageFilename('204', '40e211b7-1f09-4c45-8452-aff8d308452b')
    ).toBe('checkin-approval-room-204-40e211b7.png');

    expect(buildApprovalImageFilename('A / 12', 'sess_123456789')).toBe(
      'checkin-approval-room-A-12-sess_123.png'
    );
  });

  it('wraps long multi-paragraph text within maxWidth', () => {
    const measure = (s: string) => s.length * 10;
    const lines = wrapTextToLines(
      'مرحباً بك في الفندق\nنتمنى لك إقامة سعيدة ومريحة معنا طوال فترة زيارتك',
      180,
      measure
    );

    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      expect(measure(line)).toBeLessThanOrEqual(180);
    }
  });
});
