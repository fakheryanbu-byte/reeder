import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import type {
  CalendarType,
  CheckinPassportData,
  CheckinSessionRecord,
  DocumentType,
  ExtractedDocumentData,
  FamilyMember,
  GuestFormData,
  HotelRecord,
  LockedFormFields,
  LockedMemberFields,
  SexType,
  ValidationResult,
} from '../types/guest';

export function sanitizeWhatsAppNumber(raw: string | undefined | null): string {
  if (!raw) return '';
  return raw.replace(/[^\d]/g, '');
}

export function normalizeHotelPhoneToWhatsApp(raw: string): string {
  const normalized = normalizeMobileInput(raw);
  return sanitizeWhatsAppNumber(normalized);
}

export interface FieldVisibility {
  showVersionNumber: boolean;
  requireVersionNumber: boolean;
  showBorderNumber: boolean;
  requireBorderNumber: boolean;
  showExpiryDate: boolean;
  showFamilyMembers: boolean;
}

export const DEFAULT_SAUDI_NATIONALITY = 'سعودي';
export const DEFAULT_SAUDI_DIAL_CODE = '+966';

export function isSaudiOnlyDocumentType(docType: DocumentType): boolean {
  return docType === 'national_id' || docType === 'family_register';
}

export function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function normalizeMobileInput(raw: string): string {
  const ascii = toAsciiDigits(raw).trim();
  if (!ascii) return '';
  const compact = ascii.replace(/[\s\-()]/g, '');

  if (compact.startsWith('00966')) {
    const rest = compact.slice(5).replace(/^0+/, '');
    return `+966${rest}`;
  }
  if (compact.startsWith('+9660') && compact.length >= 13) {
    return `+966${compact.slice(5)}`;
  }
  if (/^9660?5\d{8}$/.test(compact)) {
    const rest = compact.slice(3).replace(/^0+/, '');
    return `+966${rest}`;
  }
  if (/^05\d{8}$/.test(compact)) {
    return `+966${compact.slice(1)}`;
  }
  if (/^5\d{8}$/.test(compact)) {
    return `+966${compact}`;
  }
  return ascii;
}

export function normalizeDateInput(raw: string): {
  formatted: string;
  inferredCalendar: CalendarType | null;
} {
  const ascii = toAsciiDigits(raw).trim();
  if (!ascii) {
    return { formatted: '', inferredCalendar: null };
  }

  let formatted = ascii;
  const digitsOnly = ascii.replace(/[^\d]/g, '');

  // Format pure 8-digit inputs like 14130216 or 19920815 or 15081992
  if (/^\d{8}$/.test(ascii)) {
    const first4 = Number(digitsOnly.slice(0, 4));
    const last4 = Number(digitsOnly.slice(4, 8));
    if (first4 >= 1300 && first4 <= 1550) {
      formatted = `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4, 6)}/${digitsOnly.slice(6, 8)}`;
    } else if (first4 >= 1900 && first4 <= 2100) {
      formatted = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
    } else if (last4 >= 1300 && last4 <= 1550) {
      formatted = `${digitsOnly.slice(4, 8)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(0, 2)}`;
    } else if (last4 >= 1900 && last4 <= 2100) {
      formatted = `${digitsOnly.slice(4, 8)}-${digitsOnly.slice(2, 4)}-${digitsOnly.slice(0, 2)}`;
    }
  }

  // Infer calendar from 4-digit year anywhere in formatted string
  const parts = formatted.split(/[/-]/).map((p) => Number(p));
  let inferredCalendar: CalendarType | null = null;
  for (const part of parts) {
    if (part >= 1300 && part <= 1550) {
      inferredCalendar = 'hijri';
      break;
    }
    if (part >= 1900 && part <= 2100) {
      inferredCalendar = 'gregorian';
      break;
    }
  }

  return { formatted, inferredCalendar };
}

export function createEmptyGuestForm(): GuestFormData {
  return {
    fullName: '',
    nameParts: {
      firstName: null,
      fatherName: null,
      grandfatherName: null,
      familyName: null,
    },
    documentType: 'unknown',
    documentNumber: '',
    nationality: '',
    sex: '',
    dateOfBirth: '',
    birthCalendar: 'unknown',
    expiryDate: '',
    expiryCalendar: 'unknown',
    versionNumber: '',
    borderNumber: '',
    borderNumberUnknown: false,
    mobileNumber: DEFAULT_SAUDI_DIAL_CODE,
    familyMembers: [],
    primaryMemberId: null,
    accompanyingMemberIds: [],
    purposeOfVisit: '',
    otherPurposeDetail: '',
    bookingSource: '',
    bookingReference: '',
  };
}

export function getFieldVisibility(docType: DocumentType): FieldVisibility {
  switch (docType) {
    case 'national_id':
    case 'iqama':
      return {
        showVersionNumber: true,
        requireVersionNumber: true,
        showBorderNumber: false,
        requireBorderNumber: false,
        showExpiryDate: true,
        showFamilyMembers: false,
      };
    case 'passport':
      return {
        showVersionNumber: false,
        requireVersionNumber: false,
        showBorderNumber: true,
        requireBorderNumber: true,
        showExpiryDate: true,
        showFamilyMembers: false,
      };
    case 'family_register':
      return {
        showVersionNumber: false,
        requireVersionNumber: false,
        showBorderNumber: false,
        requireBorderNumber: false,
        showExpiryDate: false,
        showFamilyMembers: true,
      };
    case 'unknown':
    default:
      return {
        showVersionNumber: false,
        requireVersionNumber: false,
        showBorderNumber: false,
        requireBorderNumber: false,
        showExpiryDate: true,
        showFamilyMembers: false,
      };
  }
}

/**
 * Updates documentType and clears any fields that do not apply to the new type.
 */
export function switchDocumentType(
  current: GuestFormData,
  nextType: DocumentType
): GuestFormData {
  const vis = getFieldVisibility(nextType);

  let nextNationality = current.nationality;
  if (isSaudiOnlyDocumentType(nextType) && !nextNationality.trim()) {
    nextNationality = DEFAULT_SAUDI_NATIONALITY;
  } else if (nextType === 'iqama' && nextNationality.trim() === DEFAULT_SAUDI_NATIONALITY) {
    nextNationality = '';
  }

  const nextMobile = current.mobileNumber.trim()
    ? current.mobileNumber
    : DEFAULT_SAUDI_DIAL_CODE;

  return {
    ...current,
    documentType: nextType,
    nationality: nextNationality,
    mobileNumber: nextMobile,
    versionNumber: vis.showVersionNumber ? current.versionNumber : '',
    borderNumber: vis.showBorderNumber ? current.borderNumber : '',
    borderNumberUnknown: vis.showBorderNumber ? current.borderNumberUnknown : false,
    expiryDate: vis.showExpiryDate ? current.expiryDate : '',
    expiryCalendar: vis.showExpiryDate ? current.expiryCalendar : 'unknown',
    primaryMemberId: vis.showFamilyMembers ? current.primaryMemberId : null,
    accompanyingMemberIds: vis.showFamilyMembers ? current.accompanyingMemberIds : [],
  };
}

function hijriToGregorianUtcDate(hy: number, hm: number, hd: number): Date {
  const jd =
    Math.floor((11 * hy + 3) / 30) +
    354 * hy +
    30 * hm -
    Math.floor((hm - 1) / 2) +
    hd +
    1948440 -
    385;
  let l = jd + 68569;
  const n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;
  return new Date(Date.UTC(y, m - 1, d));
}

export function calculateMemberAgeYears(
  dateOfBirth: string,
  birthCalendar: CalendarType,
  referenceDate: Date = new Date()
): number | null {
  const ascii = toAsciiDigits(dateOfBirth).trim();
  if (!ascii) return null;

  const parts = ascii.split(/[/\-.]/).filter(Boolean);
  if (parts.length !== 3) return null;

  const p0 = Number(parts[0]);
  const p1 = Number(parts[1]);
  const p2 = Number(parts[2]);
  if (!Number.isFinite(p0) || !Number.isFinite(p1) || !Number.isFinite(p2)) {
    return null;
  }

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4) {
    year = p0;
    month = p1;
    day = p2;
  } else if (parts[2].length === 4) {
    day = p0;
    month = p1;
    year = p2;
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  let effectiveCalendar: CalendarType = birthCalendar;
  if (year >= 1300 && year <= 1550) {
    effectiveCalendar = 'hijri';
  } else if (year >= 1900 && year <= 2100) {
    effectiveCalendar = 'gregorian';
  }

  let dobDate: Date;
  if (effectiveCalendar === 'hijri') {
    dobDate = hijriToGregorianUtcDate(year, month, day);
  } else if (effectiveCalendar === 'gregorian') {
    dobDate = new Date(Date.UTC(year, month - 1, day));
  } else {
    return null;
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  const dobYear = dobDate.getUTCFullYear();
  const dobMonth = dobDate.getUTCMonth() + 1;
  const dobDay = dobDate.getUTCDate();

  let age = refYear - dobYear;
  if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
    age -= 1;
  }
  return age;
}

export function isMemberUnder18(
  member: Pick<FamilyMember, 'dateOfBirth' | 'birthCalendar'>,
  referenceDate: Date = new Date()
): boolean {
  const age = calculateMemberAgeYears(member.dateOfBirth, member.birthCalendar, referenceDate);
  return age !== null && age < 18;
}

function normalizeMemberNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isCardholderRelationship(relationship: string): boolean {
  const rel = relationship.trim().toLowerCase();
  return (
    rel.includes('رب الأسرة') ||
    rel.includes('رب الاسرة') ||
    rel.includes('صاحب السجل') ||
    rel.includes('صاحب الكرت') ||
    rel.includes('holder') ||
    rel.includes('head')
  );
}

/**
 * Maps validated Gemini extraction onto editable GuestFormData,
 * ordering Family Register as [cardholder, member 1, member 2, ...] and appending back-page members.
 */
export function applyExtractedDataToForm(
  current: GuestFormData,
  extracted: ExtractedDocumentData | null | undefined,
  mergeMissingOnly = false
): GuestFormData {
  if (!extracted || typeof extracted !== 'object') {
    return current;
  }
  const incomingType = extracted.documentType ?? 'unknown';
  const nextType =
    mergeMissingOnly && current.documentType !== 'unknown' && incomingType === 'unknown'
      ? current.documentType
      : incomingType !== 'unknown'
        ? incomingType
        : current.documentType;

  const vis = getFieldVisibility(nextType);

  let incomingMembers: FamilyMember[] = (extracted.familyMembers ?? []).map((m, idx) => {
    const normalizedDob = normalizeDateInput(m.dateOfBirth ?? '');
    const rawCal = (m.birthCalendar ?? 'unknown') as CalendarType;
    return {
      id: `member_${idx + 1}`,
      fullName: m.fullName ?? '',
      nameParts: m.nameParts,
      documentNumber: m.documentNumber ?? '',
      sex: (m.sex === 'male' || m.sex === 'female' ? m.sex : '') as SexType,
      dateOfBirth: normalizedDob.formatted || (m.dateOfBirth ?? ''),
      birthCalendar:
        rawCal !== 'unknown'
          ? rawCal
          : (normalizedDob.inferredCalendar ?? 'unknown'),
      relationship: m.relationship ?? '',
    };
  });

  const pickStr = (incoming: string | null | undefined, existing: string) => {
    const clean = incoming ?? '';
    return mergeMissingOnly ? (existing || clean) : clean;
  };

  let resolvedNationality = pickStr(extracted.nationality, current.nationality);
  if (isSaudiOnlyDocumentType(nextType) && !resolvedNationality.trim()) {
    resolvedNationality = DEFAULT_SAUDI_NATIONALITY;
  }

  const incomingCal = (extracted.birthCalendar ?? 'unknown') as CalendarType;
  const incomingExpCal = (extracted.expiryCalendar ?? 'unknown') as CalendarType;
  const incomingSex = (extracted.sex === 'male' || extracted.sex === 'female'
    ? extracted.sex
    : '') as SexType;

  const isSameFamilyMember = (a: FamilyMember, b: FamilyMember): boolean => {
    const docA = a.documentNumber.trim();
    const docB = b.documentNumber.trim();
    if (docA && docB) {
      return docA === docB;
    }
    const nameA = normalizeMemberNameKey(a.fullName);
    const nameB = normalizeMemberNameKey(b.fullName);
    if (!nameA || !nameB) return false;
    if (nameA === nameB) return true;
    // Match slightly shortened vs full name (e.g. missing tribal surname) when IDs don't conflict
    return (nameA.startsWith(`${nameB} `) || nameB.startsWith(`${nameA} `)) && nameA.split(' ').length >= 3 && nameB.split(' ').length >= 3;
  };

  // Deduplicate incoming members while preserving first-seen order
  const dedupedIncoming: FamilyMember[] = [];
  for (const m of incomingMembers) {
    const dup = dedupedIncoming.find((existing) => isSameFamilyMember(existing, m));
    if (dup) {
      if (!dup.documentNumber && m.documentNumber) dup.documentNumber = m.documentNumber;
      if (!dup.dateOfBirth && m.dateOfBirth) dup.dateOfBirth = m.dateOfBirth;
      if (dup.birthCalendar === 'unknown' && m.birthCalendar !== 'unknown') {
        dup.birthCalendar = m.birthCalendar;
      }
      if (!dup.sex && m.sex) dup.sex = m.sex;
      if (!dup.relationship && m.relationship) dup.relationship = m.relationship;
      if (m.fullName.trim().length > dup.fullName.trim().length) {
        dup.fullName = m.fullName;
      }
    } else {
      dedupedIncoming.push(m);
    }
  }
  incomingMembers = dedupedIncoming;

  // Ensure cardholder is always index 0 in Family Register, followed by 1, 2, 3...
  if (nextType === 'family_register') {
    const topDoc = (extracted.documentNumber ?? '').trim();
    const topNameKey = normalizeMemberNameKey(extracted.fullName ?? '');
    const topProbe: FamilyMember = {
      id: 'probe',
      fullName: extracted.fullName ?? '',
      documentNumber: topDoc,
      sex: incomingSex,
      dateOfBirth: '',
      birthCalendar: 'unknown',
      relationship: '',
    };

    if (incomingMembers.length > 0) {
      const holderIdx = incomingMembers.findIndex((m) => {
        if (topDoc && m.documentNumber.trim() === topDoc) return true;
        if (topNameKey && isSameFamilyMember(m, topProbe)) return true;
        return isCardholderRelationship(m.relationship);
      });

      if (holderIdx > 0) {
        const [holder] = incomingMembers.splice(holderIdx, 1);
        incomingMembers = [holder, ...incomingMembers];
      } else if (holderIdx === -1 && !mergeMissingOnly && (extracted.fullName || topDoc)) {
        const topNormDob = normalizeDateInput(extracted.dateOfBirth ?? '');
        incomingMembers = [
          {
            id: 'member_holder',
            fullName: extracted.fullName ?? '',
            nameParts: extracted.nameParts,
            documentNumber: topDoc,
            sex: incomingSex,
            dateOfBirth: topNormDob.formatted || (extracted.dateOfBirth ?? ''),
            birthCalendar:
              incomingCal !== 'unknown'
                ? incomingCal
                : (topNormDob.inferredCalendar ?? 'unknown'),
            relationship: 'صاحب السجل',
          },
          ...incomingMembers,
        ];
      }
    } else if (!mergeMissingOnly && (extracted.fullName || topDoc)) {
      const topNormDob = normalizeDateInput(extracted.dateOfBirth ?? '');
      incomingMembers = [
        {
          id: 'member_1',
          fullName: extracted.fullName ?? '',
          nameParts: extracted.nameParts,
          documentNumber: topDoc,
          sex: incomingSex,
          dateOfBirth: topNormDob.formatted || (extracted.dateOfBirth ?? ''),
          birthCalendar:
            incomingCal !== 'unknown'
              ? incomingCal
              : (topNormDob.inferredCalendar ?? 'unknown'),
          relationship: 'صاحب السجل',
        },
      ];
    }
  }

  let finalFamilyMembers: FamilyMember[];
  if (nextType !== 'family_register') {
    finalFamilyMembers = [];
  } else if (mergeMissingOnly && current.familyMembers.length > 0) {
    // Preserve front-page order [cardholder, 1, 2, ...] and append new back-page members
    const merged = current.familyMembers.map((m) => ({ ...m }));
    for (const candidate of incomingMembers) {
      const existing = merged.find((m) => isSameFamilyMember(m, candidate));
      if (existing) {
        if (!existing.documentNumber && candidate.documentNumber) {
          existing.documentNumber = candidate.documentNumber;
        }
        if (!existing.dateOfBirth && candidate.dateOfBirth) {
          existing.dateOfBirth = candidate.dateOfBirth;
        }
        if (existing.birthCalendar === 'unknown' && candidate.birthCalendar !== 'unknown') {
          existing.birthCalendar = candidate.birthCalendar;
        }
        if (!existing.sex && candidate.sex) existing.sex = candidate.sex;
        if (!existing.relationship && candidate.relationship) {
          existing.relationship = candidate.relationship;
        }
      } else {
        merged.push({
          ...candidate,
          id: `member_${merged.length + 1}`,
        });
      }
    }
    finalFamilyMembers = merged;
  } else {
    finalFamilyMembers = incomingMembers.map((m, idx) => ({
      ...m,
      id: `member_${idx + 1}`,
    }));
  }

  const eligiblePrimary =
    finalFamilyMembers.find((m) => !isMemberUnder18(m)) ?? finalFamilyMembers[0] ?? null;

  const existingPrimaryValid =
    mergeMissingOnly &&
    current.primaryMemberId &&
    finalFamilyMembers.some(
      (m) => m.id === current.primaryMemberId && !isMemberUnder18(m)
    );

  const resolvedPrimaryId =
    nextType === 'family_register'
      ? existingPrimaryValid
        ? current.primaryMemberId
        : eligiblePrimary
          ? eligiblePrimary.id
          : null
      : null;

  const updated: GuestFormData = {
    ...current,
    documentType: nextType,
    fullName: pickStr(extracted.fullName, current.fullName),
    nameParts: mergeMissingOnly
      ? {
          firstName: current.nameParts.firstName ?? extracted.nameParts?.firstName ?? null,
          fatherName: current.nameParts.fatherName ?? extracted.nameParts?.fatherName ?? null,
          grandfatherName:
            current.nameParts.grandfatherName ?? extracted.nameParts?.grandfatherName ?? null,
          familyName: current.nameParts.familyName ?? extracted.nameParts?.familyName ?? null,
        }
      : extracted.nameParts ?? {
          firstName: null,
          fatherName: null,
          grandfatherName: null,
          familyName: null,
        },
    documentNumber: pickStr(extracted.documentNumber, current.documentNumber),
    nationality: resolvedNationality,
    sex: mergeMissingOnly ? current.sex || incomingSex : incomingSex,
    dateOfBirth: pickStr(extracted.dateOfBirth, current.dateOfBirth),
    birthCalendar:
      mergeMissingOnly && current.birthCalendar !== 'unknown' ? current.birthCalendar : incomingCal,
    expiryDate: vis.showExpiryDate ? pickStr(extracted.expiryDate, current.expiryDate) : '',
    expiryCalendar: vis.showExpiryDate
      ? mergeMissingOnly && current.expiryCalendar !== 'unknown'
        ? current.expiryCalendar
        : incomingExpCal
      : 'unknown',
    versionNumber: vis.showVersionNumber ? pickStr(extracted.versionNumber, current.versionNumber) : '',
    borderNumber: mergeMissingOnly && vis.showBorderNumber ? current.borderNumber : '',
    borderNumberUnknown: mergeMissingOnly && vis.showBorderNumber ? current.borderNumberUnknown : false,
    mobileNumber: current.mobileNumber.trim() ? current.mobileNumber : DEFAULT_SAUDI_DIAL_CODE,
    familyMembers: finalFamilyMembers,
    primaryMemberId: resolvedPrimaryId,
    accompanyingMemberIds: mergeMissingOnly ? current.accompanyingMemberIds : [],
  };

  // Fill any missing primary guest fields from the primary family member when available
  if (nextType === 'family_register' && updated.familyMembers.length > 0) {
    const primary =
      updated.familyMembers.find((m) => m.id === updated.primaryMemberId) ??
      updated.familyMembers[0];
    if (!updated.fullName && primary.fullName) updated.fullName = primary.fullName;
    if (!updated.dateOfBirth && primary.dateOfBirth) updated.dateOfBirth = primary.dateOfBirth;
    if (updated.birthCalendar === 'unknown' && primary.birthCalendar !== 'unknown') {
      updated.birthCalendar = primary.birthCalendar;
    }
    if (!updated.sex && primary.sex) updated.sex = primary.sex;
    if (!updated.documentNumber && primary.documentNumber) {
      updated.documentNumber = primary.documentNumber;
    }
  }

  return updated;
}

export function createEmptyLockedFields(): LockedFormFields {
  return {
    familyMembers: {},
  };
}

export function deriveLockedFieldsFromExtraction(
  prevLocked: LockedFormFields,
  prevForm: GuestFormData,
  nextForm: GuestFormData,
  extracted: ExtractedDocumentData,
  mergeMissingOnly: boolean
): LockedFormFields {
  const isLocked = (
    wasLocked: boolean | undefined,
    prevVal: string,
    nextVal: string,
    extractedVal: string | null | undefined
  ): boolean => {
    const hasIncoming = Boolean(extractedVal?.trim());
    if (!mergeMissingOnly) {
      return hasIncoming;
    }
    return Boolean(wasLocked || (!prevVal.trim() && nextVal.trim() && hasIncoming));
  };

  const nextMemberLocks: Record<string, LockedMemberFields> = {};
  for (const member of nextForm.familyMembers) {
    const prevMember = prevForm.familyMembers.find((pm) => pm.id === member.id);
    const prevLock = prevLocked.familyMembers[member.id];
    if (mergeMissingOnly && prevMember) {
      nextMemberLocks[member.id] = {
        fullName: Boolean(prevLock?.fullName || (!prevMember.fullName.trim() && member.fullName.trim())),
        relationship: Boolean(
          prevLock?.relationship || (!prevMember.relationship.trim() && member.relationship.trim())
        ),
        documentNumber: Boolean(
          prevLock?.documentNumber ||
            (!prevMember.documentNumber.trim() && member.documentNumber.trim())
        ),
        dateOfBirth: Boolean(
          prevLock?.dateOfBirth || (!prevMember.dateOfBirth.trim() && member.dateOfBirth.trim())
        ),
      };
    } else {
      nextMemberLocks[member.id] = {
        fullName: Boolean(member.fullName.trim()),
        relationship: Boolean(member.relationship.trim()),
        documentNumber: Boolean(member.documentNumber.trim()),
        dateOfBirth: Boolean(member.dateOfBirth.trim()),
      };
    }
  }

  return {
    documentType: mergeMissingOnly
      ? Boolean(prevLocked.documentType || (prevForm.documentType === 'unknown' && nextForm.documentType !== 'unknown'))
      : extracted.documentType !== 'unknown',
    fullName: isLocked(prevLocked.fullName, prevForm.fullName, nextForm.fullName, extracted.fullName),
    documentNumber: isLocked(
      prevLocked.documentNumber,
      prevForm.documentNumber,
      nextForm.documentNumber,
      extracted.documentNumber
    ),
    nationality: isLocked(
      prevLocked.nationality,
      prevForm.nationality,
      nextForm.nationality,
      extracted.nationality
    ),
    sex: isLocked(prevLocked.sex, prevForm.sex, nextForm.sex, extracted.sex ?? ''),
    dateOfBirth: isLocked(
      prevLocked.dateOfBirth,
      prevForm.dateOfBirth,
      nextForm.dateOfBirth,
      extracted.dateOfBirth
    ),
    expiryDate: isLocked(
      prevLocked.expiryDate,
      prevForm.expiryDate,
      nextForm.expiryDate,
      extracted.expiryDate
    ),
    versionNumber: isLocked(
      prevLocked.versionNumber,
      prevForm.versionNumber,
      nextForm.versionNumber,
      extracted.versionNumber
    ),
    familyMembers: nextMemberLocks,
  };
}

/**
 * Selects a primary guest from extracted family members (18+ only)
 * without copying the main record holder's document number onto other members.
 */
export function selectPrimaryFamilyMember(
  current: GuestFormData,
  memberId: string
): GuestFormData {
  const member = current.familyMembers.find((m) => m.id === memberId);
  if (!member || isMemberUnder18(member)) return current;

  return {
    ...current,
    primaryMemberId: memberId,
    accompanyingMemberIds: current.accompanyingMemberIds.filter((id) => id !== memberId),
    fullName: member.fullName || current.fullName,
    nameParts: member.nameParts ?? current.nameParts,
    documentNumber: member.documentNumber || '',
    sex: member.sex || current.sex,
    dateOfBirth: member.dateOfBirth || current.dateOfBirth,
    birthCalendar:
      member.birthCalendar && member.birthCalendar !== 'unknown'
        ? member.birthCalendar
        : (normalizeDateInput(member.dateOfBirth).inferredCalendar ?? current.birthCalendar),
  };
}

export function isValidMobileNumber(raw: string): boolean {
  const normalized = normalizeMobileInput(raw);
  const digits = normalized.replace(/[^\d]/g, '');
  if (digits.startsWith('966')) {
    // Saudi numbers require country code 966 + 9 subscriber digits (12 digits total; allow 11-13)
    return digits.length >= 11 && digits.length <= 13;
  }
  // International numbers require country code + subscriber digits (8-15 digits)
  return digits.length >= 8 && digits.length <= 15;
}

export function validateGuestRequest(
  form: GuestFormData,
  declarationAccepted: boolean,
  requireHotelTerms = false,
  hotelTermsAccepted = false
): ValidationResult {
  const missing: ValidationResult['missingRequiredFields'] = [];
  const missingNotesAr: string[] = [];
  const missingNotesEn: string[] = [];

  if (!form.fullName.trim()) {
    missing.push('fullName');
  }
  if (!form.documentType || form.documentType === 'unknown') {
    missing.push('documentType');
  }
  if (!form.documentNumber.trim()) {
    missing.push('documentNumber');
  }
  if (!form.nationality.trim()) {
    missing.push('nationality');
  }
  if (!form.dateOfBirth.trim()) {
    missing.push('dateOfBirth');
  }
  const effectiveBirthCalendar =
    form.birthCalendar && form.birthCalendar !== 'unknown'
      ? form.birthCalendar
      : (normalizeDateInput(form.dateOfBirth).inferredCalendar ?? 'unknown');

  if (form.documentType === 'family_register' && effectiveBirthCalendar === 'unknown') {
    missing.push('birthCalendar');
  }
  if (!isValidMobileNumber(form.mobileNumber)) {
    missing.push('mobileNumber');
  }

  const vis = getFieldVisibility(form.documentType);

  if (vis.requireVersionNumber && !form.versionNumber.trim()) {
    missing.push('versionNumber');
  }

  let isDataComplete = true;
  if (vis.requireBorderNumber) {
    if (!form.borderNumber.trim() && !form.borderNumberUnknown) {
      missing.push('borderNumber');
    } else if (!form.borderNumber.trim() && form.borderNumberUnknown) {
      isDataComplete = false;
      missingNotesAr.push('ناقص بيانات: رقم الحدود غير متوفر (طلب مساعدة الاستقبال)');
      missingNotesEn.push('Missing data: Border number unavailable (reception assistance requested)');
    }
  }

  if (!form.purposeOfVisit) {
    missing.push('purposeOfVisit');
  } else if (form.purposeOfVisit === 'other' && !form.otherPurposeDetail.trim()) {
    missing.push('otherPurposeDetail');
  }

  if (!form.bookingSource) {
    missing.push('bookingSource');
  }

  if (!declarationAccepted) {
    missing.push('declaration');
  }

  if (requireHotelTerms && !hotelTermsAccepted) {
    missing.push('hotelTerms');
  }

  if (form.documentType === 'family_register') {
    const selectedAccompanying = form.familyMembers.filter(
      (m) => m.id !== form.primaryMemberId && form.accompanyingMemberIds.includes(m.id)
    );
    if (selectedAccompanying.some((m) => !m.fullName.trim())) {
      missing.push('accompanyingMemberNames');
    }
    if (selectedAccompanying.some((m) => !m.dateOfBirth.trim())) {
      missing.push('accompanyingMemberBirthDates');
    }

    missingNotesAr.push('سجل الأسرة: قد يطلب الاستقبال وثيقة إضافية لاستكمال التسجيل');
    missingNotesEn.push('Family Register: reception may request an additional document to complete registration');
  }

  return {
    canOpenWhatsApp: missing.length === 0,
    isDataComplete,
    missingRequiredFields: missing,
    missingNotesAr,
    missingNotesEn,
  };
}

function formatCalendarLabel(cal: CalendarType): string {
  if (cal === 'hijri') return `${ar.calendarHijri} / ${en.calendarHijri}`;
  if (cal === 'gregorian') return `${ar.calendarGregorian} / ${en.calendarGregorian}`;
  return `${ar.calendarUnknown} / ${en.calendarUnknown}`;
}

function formatSexLabel(sex: SexType): string {
  if (sex === 'male') return `${ar.sexMale} / ${en.sexMale}`;
  if (sex === 'female') return `${ar.sexFemale} / ${en.sexFemale}`;
  return '';
}

export function buildWhatsAppMessage(
  form: GuestFormData,
  extraNotes: string[] = [],
  roomNumber?: string | null,
  hotelName?: string | null,
  roomPrice?: number | null
): string {
  const vis = getFieldVisibility(form.documentType);
  const docTypeLabel = `${ar.docTypes[form.documentType]} / ${en.docTypes[form.documentType]}`;

  const purposeLabel = form.purposeOfVisit
    ? form.purposeOfVisit === 'other'
      ? `${ar.purposes.other} / ${en.purposes.other}: ${form.otherPurposeDetail.trim()}`
      : `${ar.purposes[form.purposeOfVisit]} / ${en.purposes[form.purposeOfVisit]}`
    : '';

  const bookingSourceLabel = form.bookingSource
    ? `${ar.bookingSources[form.bookingSource]} / ${en.bookingSources[form.bookingSource]}`
    : '';

  const lines: string[] = [
    'طلب تجهيز بيانات نزيل / Guest registration request',
    '',
    ...(hotelName?.trim() ? [`الفندق / Hotel: ${hotelName.trim()}`] : []),
    ...(roomNumber?.trim() ? [`رقم الغرفة / Room number: ${roomNumber.trim()}`] : []),
    ...(typeof roomPrice === 'number' && Number.isFinite(roomPrice) && roomPrice >= 0
      ? [`سعر الغرفة / Room price: ${formatCurrencyPrice(roomPrice, 'ar')} / ${formatCurrencyPrice(roomPrice, 'en')}`]
      : []),
    `الاسم / Name: ${form.fullName.trim()}`,
    `نوع الوثيقة / Document type: ${docTypeLabel}`,
    `رقم الوثيقة / Document number: ${form.documentNumber.trim()}`,
    `الجنسية / Nationality: ${form.nationality.trim()}`,
  ];

  const sexText = formatSexLabel(form.sex);
  if (sexText) {
    lines.push(`الجنس / Sex: ${sexText}`);
  }

  const effectiveBirthCalendar =
    form.birthCalendar && form.birthCalendar !== 'unknown'
      ? form.birthCalendar
      : (normalizeDateInput(form.dateOfBirth).inferredCalendar ?? 'unknown');
  const birthCalSuffix =
    effectiveBirthCalendar !== 'unknown' ? ` (${formatCalendarLabel(effectiveBirthCalendar)})` : '';
  lines.push(
    `تاريخ الميلاد / Date of birth: ${form.dateOfBirth.trim()}${birthCalSuffix}`
  );

  const effectiveExpiryCalendar =
    form.expiryCalendar && form.expiryCalendar !== 'unknown'
      ? form.expiryCalendar
      : (normalizeDateInput(form.expiryDate).inferredCalendar ?? 'unknown');
  if (vis.showExpiryDate && form.expiryDate.trim()) {
    const expCal =
      effectiveExpiryCalendar !== 'unknown'
        ? ` (${formatCalendarLabel(effectiveExpiryCalendar)})`
        : '';
    lines.push(`تاريخ الانتهاء / Expiry date: ${form.expiryDate.trim()}${expCal}`);
  }

  if (vis.showVersionNumber && form.versionNumber.trim()) {
    lines.push(`رقم النسخة / Version number: ${form.versionNumber.trim()}`);
  }

  if (vis.showBorderNumber) {
    if (form.borderNumber.trim()) {
      lines.push(`رقم الحدود / Border number: ${form.borderNumber.trim()}`);
    } else if (form.borderNumberUnknown) {
      lines.push(
        'رقم الحدود / Border number: غير متوفر — ناقص بيانات (طلب مساعدة الاستقبال) / Unavailable — Missing data (reception assistance requested)'
      );
    }
  }

  lines.push(`الجوال / Mobile: ${form.mobileNumber.trim()}`);
  lines.push(`سبب الزيارة / Purpose of visit: ${purposeLabel}`);
  lines.push(`مصدر الحجز / Booking source: ${bookingSourceLabel}`);

  if (form.bookingSource === 'booking_com' && form.bookingReference.trim()) {
    lines.push(`مرجع الحجز / Booking reference: ${form.bookingReference.trim()}`);
  }

  if (form.documentType === 'family_register') {
    const accompanying = form.familyMembers.filter(
      (m) =>
        m.id !== form.primaryMemberId &&
        form.accompanyingMemberIds.includes(m.id) &&
        m.fullName.trim()
    );
    if (accompanying.length > 0) {
      const formattedCompanions = accompanying
        .map((m) => {
          const parts = [m.fullName.trim()];
          if (m.relationship.trim()) parts.push(m.relationship.trim());
          if (m.documentNumber.trim()) parts.push(`ID: ${m.documentNumber.trim()}`);
          if (m.dateOfBirth.trim()) {
            const cal =
              m.birthCalendar && m.birthCalendar !== 'unknown'
                ? ` (${formatCalendarLabel(m.birthCalendar)})`
                : '';
            parts.push(`DOB: ${m.dateOfBirth.trim()}${cal}`);
          }
          return parts.join(' - ');
        })
        .join(' | ');
      lines.push(`المرافقون / Accompanying guests: ${formattedCompanions}`);
    }
  }

  const notes: string[] = [...extraNotes];
  if (vis.showBorderNumber && !form.borderNumber.trim() && form.borderNumberUnknown) {
    notes.push('حالة الطلب: ناقص بيانات (رقم الحدود غير متوفر) / Status: Missing data (border number unavailable)');
  }
  if (form.documentType === 'family_register') {
    notes.push('سجل الأسرة: قد يطلب الاستقبال وثيقة إضافية / Family register: reception may request additional ID');
  }

  if (notes.length > 0) {
    lines.push(`النواقص أو الملاحظات / Missing information or notes: ${notes.join(' ؛ ')}`);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(message: string, whatsappNumber?: string | null): string {
  const digits = sanitizeWhatsAppNumber(whatsappNumber);
  if (digits) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildCheckinPassportData(form: GuestFormData): CheckinPassportData {
  return {
    documentType: form.documentType,
    documentNumber: form.documentNumber.trim().slice(0, 80),
    sex: form.sex,
    dateOfBirth: form.dateOfBirth.trim().slice(0, 40),
    birthCalendar: form.birthCalendar,
    expiryDate: form.expiryDate.trim().slice(0, 40),
    expiryCalendar: form.expiryCalendar,
    versionNumber: form.versionNumber.trim().slice(0, 40),
    borderNumber: form.borderNumber.trim().slice(0, 80),
    borderNumberUnknown: Boolean(form.borderNumberUnknown),
    mobileNumber: form.mobileNumber.trim().slice(0, 30),
    familyMembers: form.familyMembers.slice(0, 25).map((m) => ({
      id: m.id,
      fullName: m.fullName.trim().slice(0, 200),
      documentNumber: m.documentNumber.trim().slice(0, 80),
      sex: m.sex,
      dateOfBirth: m.dateOfBirth.trim().slice(0, 40),
      birthCalendar: m.birthCalendar,
      relationship: m.relationship.trim().slice(0, 60),
    })),
    primaryMemberId: form.primaryMemberId,
    accompanyingMemberIds: form.accompanyingMemberIds.slice(0, 25),
    purposeOfVisit: form.purposeOfVisit,
    otherPurposeDetail: form.otherPurposeDetail.trim().slice(0, 200),
    bookingSource: form.bookingSource,
    bookingReference: form.bookingReference.trim().slice(0, 100),
  };
}

export function checkinSessionToGuestForm(session: CheckinSessionRecord): GuestFormData {
  const pd = session.passportData;
  return {
    ...createEmptyGuestForm(),
    fullName: session.guestName,
    nationality: session.nationality,
    documentType: pd.documentType ?? 'unknown',
    documentNumber: pd.documentNumber ?? '',
    sex: pd.sex ?? '',
    dateOfBirth: pd.dateOfBirth ?? '',
    birthCalendar: pd.birthCalendar ?? 'unknown',
    expiryDate: pd.expiryDate ?? '',
    expiryCalendar: pd.expiryCalendar ?? 'unknown',
    versionNumber: pd.versionNumber ?? '',
    borderNumber: pd.borderNumber ?? '',
    borderNumberUnknown: Boolean(pd.borderNumberUnknown),
    mobileNumber: pd.mobileNumber ?? DEFAULT_SAUDI_DIAL_CODE,
    familyMembers: Array.isArray(pd.familyMembers) ? pd.familyMembers : [],
    primaryMemberId: pd.primaryMemberId ?? null,
    accompanyingMemberIds: Array.isArray(pd.accompanyingMemberIds)
      ? pd.accompanyingMemberIds
      : [],
    purposeOfVisit: pd.purposeOfVisit ?? '',
    otherPurposeDetail: pd.otherPurposeDetail ?? '',
    bookingSource: pd.bookingSource ?? '',
    bookingReference: pd.bookingReference ?? '',
  };
}

export function isHotelExpired(
  hotel: Pick<HotelRecord, 'status' | 'expiresAt'>,
  now: Date = new Date()
): boolean {
  return (
    hotel.status === 'approved' &&
    Boolean(hotel.expiresAt && hotel.expiresAt.getTime() <= now.getTime())
  );
}

export function isHotelOperational(
  hotel: Pick<HotelRecord, 'status' | 'isActive' | 'expiresAt'>,
  now: Date = new Date()
): boolean {
  return (
    hotel.status === 'approved' &&
    hotel.isActive &&
    (!hotel.expiresAt || hotel.expiresAt.getTime() > now.getTime())
  );
}

export function sanitizeDecimalPriceInput(raw: string): string {
  const ascii = toAsciiDigits(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dotIdx = ascii.indexOf('.');
  if (dotIdx === -1) {
    return ascii.slice(0, 7);
  }
  const intPart = ascii.slice(0, dotIdx).slice(0, 7);
  const decPart = ascii.slice(dotIdx + 1).replace(/\./g, '').slice(0, 2);
  return `${intPart}.${decPart}`;
}

export function parseValidPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0 || num > 1_000_000) return null;
  return Math.round(num * 100) / 100;
}

export function calculateDiscountPercent(
  originalPrice: number,
  finalPrice: number
): number | null {
  if (
    !Number.isFinite(originalPrice) ||
    !Number.isFinite(finalPrice) ||
    originalPrice <= 0 ||
    finalPrice < 0 ||
    finalPrice > originalPrice
  ) {
    return null;
  }
  const pct = ((originalPrice - finalPrice) / originalPrice) * 100;
  return Math.round(pct * 100) / 100;
}

export function formatCurrencyPrice(amount: number, lang: 'ar' | 'en'): string {
  const clean = Number.isInteger(amount)
    ? String(amount)
    : Number(amount.toFixed(2)).toString();
  return lang === 'ar' ? `${clean} ر.س` : `${clean} SAR`;
}

export const WELCOME_MESSAGE_MAX_LENGTH = 1000;

export const DEFAULT_WELCOME_TEMPLATE_TEXT_AR =
  'مرحباً بك في {hotel}، {guest}! تم تأكيد تسجيلك بنجاح، رقم غرفتك هو {room}. نتمنى لك إقامة سعيدة.';

export const DEFAULT_WELCOME_TEMPLATE_TEXT_EN =
  'Welcome to {hotel}, {guest}! Your check-in is confirmed for Room {room}. Enjoy your stay!';

export function formatWelcomeMessageFromTemplate(
  template: string | undefined | null,
  params: {
    hotelName: string;
    guestName: string;
    roomNumber: string;
    lang: 'ar' | 'en';
  }
): string {
  const fallback =
    params.lang === 'ar'
      ? DEFAULT_WELCOME_TEMPLATE_TEXT_AR
      : DEFAULT_WELCOME_TEMPLATE_TEXT_EN;
  const rawTemplate = template && template.trim() ? template.trim() : fallback;
  const hotelPart = params.hotelName.trim();
  const guestPart = params.guestName.trim();
  const roomPart = params.roomNumber.trim() || '...';

  return rawTemplate
    .replace(/\{hotel\}|\{الفندق\}/gi, hotelPart)
    .replace(/\{guest\}|\{النزيل\}/gi, guestPart)
    .replace(/\{room\}|\{الغرفة\}/gi, roomPart)
    .trim()
    .slice(0, WELCOME_MESSAGE_MAX_LENGTH);
}

