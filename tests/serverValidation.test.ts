import { describe, expect, it } from 'vitest';
import {
  sanitizeExtractedPayload,
  validateIncomingImages,
} from '../server/geminiDocumentParser';

// Minimal valid 1x1 JPEG header + EOI bytes for testing magic byte validation
const TINY_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]).toString('base64');

describe('Server-side image validation and Gemini output sanitization', () => {
  it('rejects empty image arrays, invalid MIME types, and forged magic bytes', () => {
    const empty = validateIncomingImages([]);
    expect(empty.ok).toBe(false);

    const badMime = validateIncomingImages([
      { mimeType: 'application/pdf', base64: TINY_JPEG_BASE64 },
    ]);
    expect(badMime.ok).toBe(false);
    if (!badMime.ok) expect(badMime.code).toBe('UNSUPPORTED_MIME');

    const forgedPng = validateIncomingImages([
      { mimeType: 'image/png', base64: TINY_JPEG_BASE64 },
    ]);
    expect(forgedPng.ok).toBe(false);
    if (!forgedPng.ok) expect(forgedPng.code).toBe('INVALID_IMAGE_HEADER');
  });

  it('rejects oversized images (> 10 MB) and > 2 images', () => {
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 10);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    const tooLarge = validateIncomingImages([
      { mimeType: 'image/jpeg', base64: oversizedBuffer.toString('base64') },
    ]);
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.status).toBe(413);

    const tooMany = validateIncomingImages([
      { mimeType: 'image/jpeg', base64: TINY_JPEG_BASE64 },
      { mimeType: 'image/jpeg', base64: TINY_JPEG_BASE64 },
      { mimeType: 'image/jpeg', base64: TINY_JPEG_BASE64 },
    ]);
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.code).toBe('TOO_MANY_IMAGES');
  });

  it('accepts valid JPEG images up to 2 pages', () => {
    const valid = validateIncomingImages([
      { mimeType: 'image/jpeg', base64: TINY_JPEG_BASE64 },
      { mimeType: 'image/jpeg', base64: TINY_JPEG_BASE64 },
    ]);
    expect(valid.ok).toBe(true);
  });

  it('sanitizes Gemini structured output, normalizes null/N/A strings, and keeps leading zeros', () => {
    const sanitized = sanitizeExtractedPayload({
      documentType: 'iqama',
      fullName: '  عمر محمد علي  ',
      nameParts: {
        firstName: 'عمر',
        fatherName: 'null',
        grandfatherName: 'N/A',
        familyName: 'علي',
      },
      documentNumber: '0024567890',
      nationality: 'اليمن',
      sex: 'M',
      dateOfBirth: '1994/11/03',
      birthCalendar: 'gregorian',
      expiryDate: '1449/04/10',
      expiryCalendar: 'hijri',
      versionNumber: '01',
      familyMembers: [{ fullName: 'should be ignored for iqama' }],
      unreadableFields: ['', 'placeOfIssue'],
      warnings: ['Glare near bottom corner'],
    });

    expect(sanitized.documentType).toBe('iqama');
    expect(sanitized.fullName).toBe('عمر محمد علي');
    expect(sanitized.nameParts.fatherName).toBeNull();
    expect(sanitized.nameParts.grandfatherName).toBeNull();
    expect(sanitized.documentNumber).toBe('0024567890');
    expect(sanitized.versionNumber).toBe('01');
    expect(sanitized.sex).toBe('male');
    expect(sanitized.familyMembers).toEqual([]);
    expect(sanitized.unreadableFields).toEqual(['placeOfIssue']);
    expect(sanitized.warnings).toEqual(['Glare near bottom corner']);
  });

  it('defaults nationality to سعودي for national_id and family_register when omitted', () => {
    const nat = sanitizeExtractedPayload({
      documentType: 'national_id',
      nationality: null,
    });
    expect(nat.nationality).toBe('سعودي');

    const fam = sanitizeExtractedPayload({
      documentType: 'family_register',
      nationality: '',
    });
    expect(fam.nationality).toBe('سعودي');
  });
});
