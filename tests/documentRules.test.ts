import { describe, expect, it } from 'vitest';
import { getTranslations } from '../src/i18n';
import type { ExtractedDocumentData } from '../src/types/guest';
import {
  applyExtractedDataToForm,
  buildCheckinPassportData,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  calculateDiscountPercent,
  checkinSessionToGuestForm,
  createEmptyGuestForm,
  createEmptyLockedFields,
  deriveLockedFieldsFromExtraction,
  getFieldVisibility,
  isHotelExpired,
  isHotelOperational,
  isMemberUnder18,
  isValidMobileNumber,
  normalizeDateInput,
  normalizeHotelPhoneToWhatsApp,
  normalizeMobileInput,
  parseValidPrice,
  sanitizeDecimalPriceInput,
  sanitizeWhatsAppNumber,
  selectPrimaryFamilyMember,
  switchDocumentType,
  validateGuestRequest,
} from '../src/utils/documentRules';

describe('Document extraction mapping and conditional rules', () => {
  it('preserves leading zeros and applies National ID rules (requires versionNumber, hides borderNumber)', () => {
    const extracted: ExtractedDocumentData = {
      documentType: 'national_id',
      fullName: 'سالم بن خالد العتيبي',
      nameParts: {
        firstName: 'سالم',
        fatherName: 'خالد',
        grandfatherName: null,
        familyName: 'العتيبي',
      },
      documentNumber: '0010456789',
      nationality: 'المملكة العربية السعودية',
      sex: 'male',
      dateOfBirth: '1412/05/19',
      birthCalendar: 'hijri',
      expiryDate: '1450/08/01',
      expiryCalendar: 'hijri',
      versionNumber: '02',
      familyMembers: [],
      unreadableFields: [],
      warnings: [],
    };

    const form = applyExtractedDataToForm(createEmptyGuestForm(), extracted);
    expect(form.documentNumber).toBe('0010456789');
    expect(form.versionNumber).toBe('02');

    const vis = getFieldVisibility(form.documentType);
    expect(vis.showVersionNumber).toBe(true);
    expect(vis.requireVersionNumber).toBe(true);
    expect(vis.showBorderNumber).toBe(false);

    // Missing version number fails validation for national_id
    const missingVersion = validateGuestRequest(
      {
        ...form,
        versionNumber: '',
        mobileNumber: '+966500000099',
        purposeOfVisit: 'tourism',
        bookingSource: 'reception',
      },
      true
    );
    expect(missingVersion.canOpenWhatsApp).toBe(false);
    expect(missingVersion.missingRequiredFields).toContain('versionNumber');
  });

  it('clears inapplicable fields when switching between National ID and Passport', () => {
    let form = createEmptyGuestForm();
    form = {
      ...form,
      documentType: 'national_id',
      versionNumber: '03',
      fullName: 'Tariq Alharbi',
      documentNumber: '1000000001',
      nationality: 'Saudi',
      dateOfBirth: '1991-03-11',
      birthCalendar: 'gregorian',
      mobileNumber: '+966500000011',
    };

    // Switch to passport -> versionNumber must be cleared, borderNumber shown & required
    const passportForm = switchDocumentType(form, 'passport');
    expect(passportForm.documentType).toBe('passport');
    expect(passportForm.versionNumber).toBe('');

    const visPassport = getFieldVisibility('passport');
    expect(visPassport.showVersionNumber).toBe(false);
    expect(visPassport.showBorderNumber).toBe(true);
    expect(visPassport.requireBorderNumber).toBe(true);

    // Switch back to iqama -> borderNumber and borderNumberUnknown must be cleared
    const withBorder = {
      ...passportForm,
      borderNumber: '9988776655',
      borderNumberUnknown: true,
    };
    const iqamaForm = switchDocumentType(withBorder, 'iqama');
    expect(iqamaForm.borderNumber).toBe('');
    expect(iqamaForm.borderNumberUnknown).toBe(false);
  });

  it('marks passport without border number as incomplete data when reception assistance is requested', () => {
    const form = {
      ...createEmptyGuestForm(),
      documentType: 'passport' as const,
      fullName: 'John Synthetic Doe',
      documentNumber: 'P0012345',
      nationality: 'United Kingdom',
      dateOfBirth: '1988-09-02',
      birthCalendar: 'gregorian' as const,
      expiryDate: '2030-01-15',
      expiryCalendar: 'gregorian' as const,
      borderNumber: '',
      borderNumberUnknown: true,
      mobileNumber: '+447700900077',
      purposeOfVisit: 'business' as const,
      bookingSource: 'booking_com' as const,
      bookingReference: 'BK-998877',
    };

    const result = validateGuestRequest(form, true);
    expect(result.canOpenWhatsApp).toBe(true);
    expect(result.isDataComplete).toBe(false);
    expect(result.missingNotesAr[0]).toContain('ناقص بيانات');

    const msg = buildWhatsAppMessage(form);
    expect(msg).not.toContain('الفندق / Hotel:');
    expect(msg).toContain('ناقص بيانات');
    expect(msg).not.toContain('رقم النسخة / Version number');
    expect(msg).toContain('مرجع الحجز / Booking reference: BK-998877');
  });

  it('handles Family Register without copying holder ID and includes only selected accompanying guests', () => {
    const extracted: ExtractedDocumentData = {
      documentType: 'family_register',
      fullName: 'فهد بن سعد الشمري',
      nameParts: { firstName: 'فهد', fatherName: 'سعد', grandfatherName: null, familyName: 'الشمري' },
      documentNumber: '1011223344',
      nationality: 'المملكة العربية السعودية',
      sex: 'male',
      dateOfBirth: '1405/01/01',
      birthCalendar: 'hijri',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'فهد بن سعد الشمري',
          documentNumber: '1011223344',
          sex: 'male',
          dateOfBirth: '1405/01/01',
          birthCalendar: 'hijri',
          relationship: 'رب الأسرة',
        },
        {
          fullName: 'نورة بنت علي',
          documentNumber: '',
          sex: 'female',
          dateOfBirth: '1408/03/12',
          birthCalendar: 'hijri',
          relationship: 'زوجة',
        },
        {
          fullName: 'سلمان فهد الشمري',
          documentNumber: '',
          sex: 'male',
          dateOfBirth: '1436/07/20',
          birthCalendar: 'hijri',
          relationship: 'ابن',
        },
      ],
      unreadableFields: [],
      warnings: [],
    };

    let form = applyExtractedDataToForm(createEmptyGuestForm(), extracted);
    // Neither spouse nor child got holder's documentNumber copied
    expect(form.familyMembers[1].documentNumber).toBe('');
    expect(form.familyMembers[2].documentNumber).toBe('');

    // Select spouse as primary guest -> primary documentNumber becomes '' (not copied from previous primary)
    form = selectPrimaryFamilyMember(form, 'member_2');
    expect(form.fullName).toBe('نورة بنت علي');
    expect(form.documentNumber).toBe('');

    // Select only member_3 as actual accompanying guest (leave member_1 out)
    form = {
      ...form,
      documentNumber: '1099887766',
      nationality: 'المملكة العربية السعودية',
      mobileNumber: '+966500000088',
      accompanyingMemberIds: ['member_3'],
      purposeOfVisit: 'family_friends',
      bookingSource: 'reception',
    };

    const msg = buildWhatsAppMessage(form);
    expect(msg).toContain('المرافقون / Accompanying guests: سلمان فهد الشمري');
    expect(msg).not.toContain('فهد بن سعد الشمري');
    expect(msg).not.toContain('رقم النسخة / Version number');
    expect(msg).not.toContain('رقم الحدود / Border number');
    expect(msg).not.toContain('مرجع الحجز / Booking reference');
  });
});

describe('General WhatsApp URL, Visit Purpose, Language, and Sharing', () => {
  it('builds a general wa.me/?text= URL when no recipient number is set', () => {
    const form = {
      ...createEmptyGuestForm(),
      documentType: 'national_id' as const,
      fullName: 'Test Guest',
      documentNumber: '1020304050',
      nationality: 'Saudi',
      dateOfBirth: '1990-01-01',
      birthCalendar: 'gregorian' as const,
      versionNumber: '1',
      mobileNumber: '+966500000000',
      purposeOfVisit: 'tourism' as const,
      bookingSource: 'reception' as const,
    };

    const res = validateGuestRequest(form, true);
    expect(res.canOpenWhatsApp).toBe(true);
    expect(buildWhatsAppUrl('طلب تجهيز بيانات نزيل')).toMatch(
      /^https:\/\/wa\.me\/\?text=/
    );
  });

  it('builds valid wa.me URL when optional WhatsApp number is provided and strips formatting characters', () => {
    const cleaned = sanitizeWhatsAppNumber('+966 50-000-0005');
    expect(cleaned).toBe('966500000005');

    const url = buildWhatsAppUrl('طلب تجهيز بيانات نزيل', cleaned);
    expect(url).toMatch(/^https:\/\/wa\.me\/966500000005\?text=/);
  });

  it('requires clarification text when purpose of visit is Other', () => {
    const form = {
      ...createEmptyGuestForm(),
      documentType: 'iqama' as const,
      fullName: 'Guest Name',
      documentNumber: '2020202020',
      nationality: 'Egypt',
      dateOfBirth: '1993-04-12',
      birthCalendar: 'gregorian' as const,
      versionNumber: '2',
      mobileNumber: '+966500000012',
      purposeOfVisit: 'other' as const,
      otherPurposeDetail: '',
      bookingSource: 'reception' as const,
    };

    const invalid = validateGuestRequest(form, true);
    expect(invalid.canOpenWhatsApp).toBe(false);
    expect(invalid.missingRequiredFields).toContain('otherPurposeDetail');

    const valid = validateGuestRequest(
      { ...form, otherPurposeDetail: 'حضور مؤتمر' },
      true
    );
    expect(valid.canOpenWhatsApp).toBe(true);
    const msg = buildWhatsAppMessage({ ...form, otherPurposeDetail: 'حضور مؤتمر' });
    expect(msg).toContain('أخرى / Other: حضور مؤتمر');
  });

  it('provides complete Arabic and English translation keys without altering guest data', () => {
    const arDict = getTranslations('ar');
    const enDict = getTranslations('en');
    expect(Object.keys(arDict).sort()).toEqual(Object.keys(enDict).sort());
    expect(enDict.messageReadySuccess).toBe('Your message is ready. Complete sending in WhatsApp.');
    expect(arDict.messageReadySuccess).toBe('تم تجهيز الرسالة. أكمل الإرسال داخل واتساب.');
  });

  it('returns current form safely if extracted payload is undefined or null', () => {
    const initial = createEmptyGuestForm();
    const resUndefined = applyExtractedDataToForm(initial, undefined);
    const resNull = applyExtractedDataToForm(initial, null);
    expect(resUndefined).toEqual(initial);
    expect(resNull).toEqual(initial);
  });

  it('merges versionNumber from a second-side scan without erasing already extracted front-side details', () => {
    const front = applyExtractedDataToForm(createEmptyGuestForm(), {
      documentType: 'national_id',
      fullName: 'أحمد محمد العمري',
      nameParts: { firstName: 'أحمد', fatherName: 'محمد', grandfatherName: null, familyName: 'العمري' },
      documentNumber: '1012345678',
      nationality: 'المملكة العربية السعودية',
      sex: 'male',
      dateOfBirth: '1410/03/15',
      birthCalendar: 'hijri',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [],
      unreadableFields: ['versionNumber'],
      warnings: [],
    });

    const merged = applyExtractedDataToForm(
      front,
      {
        documentType: 'unknown',
        fullName: null,
        nameParts: { firstName: null, fatherName: null, grandfatherName: null, familyName: null },
        documentNumber: null,
        nationality: null,
        sex: null,
        dateOfBirth: null,
        birthCalendar: 'unknown',
        expiryDate: '1452/01/01',
        expiryCalendar: 'hijri',
        versionNumber: '04',
        familyMembers: [],
        unreadableFields: [],
        warnings: [],
      },
      true
    );

    expect(merged.documentType).toBe('national_id');
    expect(merged.fullName).toBe('أحمد محمد العمري');
    expect(merged.documentNumber).toBe('1012345678');
    expect(merged.versionNumber).toBe('04');
    expect(merged.expiryDate).toBe('1452/01/01');
  });

  it('defaults nationality to سعودي for National ID and Family Register and prefills +966 mobile code', () => {
    const empty = createEmptyGuestForm();
    expect(empty.mobileNumber).toBe('+966');
    expect(isValidMobileNumber(empty.mobileNumber)).toBe(false);

    // Switching manually to national_id or family_register defaults empty nationality to سعودي
    const manualNationalId = switchDocumentType(empty, 'national_id');
    expect(manualNationalId.nationality).toBe('سعودي');

    // Switching to iqama clears the auto-defaulted سعودي nationality
    const switchedToIqama = switchDocumentType(manualNationalId, 'iqama');
    expect(switchedToIqama.nationality).toBe('');

    // Extracting a family register with null nationality and primary member DOB fills both
    const familyForm = applyExtractedDataToForm(createEmptyGuestForm(), {
      documentType: 'family_register',
      fullName: 'عبدالرحيم علي المالكي',
      nameParts: { firstName: 'عبدالرحيم', fatherName: 'علي', grandfatherName: null, familyName: 'المالكي' },
      documentNumber: '1008592030',
      nationality: null,
      sex: 'male',
      dateOfBirth: null,
      birthCalendar: 'unknown',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'عبدالرحيم علي المالكي',
          documentNumber: '1008592030',
          sex: 'male',
          dateOfBirth: '1402/06/29',
          birthCalendar: 'hijri',
          relationship: 'رب الأسرة',
        },
      ],
      unreadableFields: [],
      warnings: [],
    });

    expect(familyForm.nationality).toBe('سعودي');
    expect(familyForm.mobileNumber).toBe('+966');
    expect(familyForm.dateOfBirth).toBe('1402/06/29');
    expect(familyForm.birthCalendar).toBe('hijri');
  });

  it('normalizes Arabic digits, Saudi phone formats, and 8-digit dates with calendar inference', () => {
    expect(normalizeMobileInput('+966٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567');
    expect(normalizeMobileInput('0501234567')).toBe('+966501234567');
    expect(normalizeMobileInput('501234567')).toBe('+966501234567');
    expect(isValidMobileNumber('+966501234567')).toBe(true);
    expect(isValidMobileNumber('+966')).toBe(false);

    expect(normalizeDateInput('١٤١٣٠٢١٦')).toEqual({
      formatted: '1413/02/16',
      inferredCalendar: 'hijri',
    });
    expect(normalizeDateInput('19920815')).toEqual({
      formatted: '1992-08-15',
      inferredCalendar: 'gregorian',
    });
  });

  it('requires date of birth for every selected accompanying guest in Family Register', () => {
    const base = applyExtractedDataToForm(createEmptyGuestForm(), {
      documentType: 'family_register',
      fullName: 'عبدالرحيم علي المالكي',
      nameParts: { firstName: 'عبدالرحيم', fatherName: 'علي', grandfatherName: null, familyName: 'المالكي' },
      documentNumber: '1008592030',
      nationality: 'سعودي',
      sex: 'male',
      dateOfBirth: '1402/06/29',
      birthCalendar: 'hijri',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'عبدالرحيم علي المالكي',
          documentNumber: '1008592030',
          sex: 'male',
          dateOfBirth: '1402/06/29',
          birthCalendar: 'hijri',
          relationship: 'رب الأسرة',
        },
        {
          fullName: 'تميم عبدالرحيم المالكي',
          documentNumber: '1137344248',
          sex: 'male',
          dateOfBirth: '',
          birthCalendar: 'unknown',
          relationship: 'ابن',
        },
      ],
      unreadableFields: [],
      warnings: [],
    });

    const missingDobForm = {
      ...base,
      mobileNumber: '+966500000011',
      purposeOfVisit: 'tourism' as const,
      bookingSource: 'reception' as const,
      accompanyingMemberIds: ['member_2'],
    };

    const invalid = validateGuestRequest(missingDobForm, true);
    expect(invalid.canOpenWhatsApp).toBe(false);
    expect(invalid.missingRequiredFields).toContain('accompanyingMemberBirthDates');

    const withCompanionDob = {
      ...missingDobForm,
      familyMembers: missingDobForm.familyMembers.map((m) =>
        m.id === 'member_2' ? { ...m, dateOfBirth: '1439/04/12', birthCalendar: 'hijri' as const } : m
      ),
    };

    const valid = validateGuestRequest(withCompanionDob, true);
    expect(valid.canOpenWhatsApp).toBe(true);
    const msg = buildWhatsAppMessage(withCompanionDob);
    expect(msg).toContain('DOB: 1439/04/12 (هجري / Hijri)');
  });

  it('orders cardholder first, appends back-page members in sequence, and restricts primary selection for under-18 members', () => {
    // Page 1: cardholder in top-level fields, plus member 1 and member 2
    const page1 = applyExtractedDataToForm(createEmptyGuestForm(), {
      documentType: 'family_register',
      fullName: 'سعد بن محمد القحطاني',
      nameParts: { firstName: 'سعد', fatherName: 'محمد', grandfatherName: null, familyName: 'القحطاني' },
      documentNumber: '1010101010',
      nationality: 'سعودي',
      sex: 'male',
      dateOfBirth: '1400/01/10',
      birthCalendar: 'hijri',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'نورة القحطاني',
          documentNumber: '1020202020',
          sex: 'female',
          dateOfBirth: '1405/03/15',
          birthCalendar: 'hijri',
          relationship: 'زوجة',
        },
        {
          fullName: 'خالد سعد القحطاني',
          documentNumber: '1133445566',
          sex: 'male',
          dateOfBirth: '1438/05/01',
          birthCalendar: 'hijri',
          relationship: 'ابن',
        },
      ],
      unreadableFields: [],
      warnings: [],
    });

    // Cardholder automatically prepended at index 0, followed by 1 and 2
    expect(page1.familyMembers.map((m) => m.fullName)).toEqual([
      'سعد بن محمد القحطاني',
      'نورة القحطاني',
      'خالد سعد القحطاني',
    ]);
    expect(page1.primaryMemberId).toBe('member_1');

    // Page 2 (back side): appends member 3 after existing members without overwriting front page
    const withBackPage = applyExtractedDataToForm(
      page1,
      {
        documentType: 'family_register',
        fullName: null,
        nameParts: { firstName: null, fatherName: null, grandfatherName: null, familyName: null },
        documentNumber: null,
        nationality: null,
        sex: null,
        dateOfBirth: null,
        birthCalendar: 'unknown',
        expiryDate: null,
        expiryCalendar: 'unknown',
        versionNumber: null,
        familyMembers: [
          {
            fullName: 'سارة سعد القحطاني',
            documentNumber: '1144556677',
            sex: 'female',
            dateOfBirth: '2016-06-10',
            birthCalendar: 'gregorian',
            relationship: 'بنت',
          },
        ],
        unreadableFields: [],
        warnings: [],
      },
      true
    );

    expect(withBackPage.familyMembers.map((m) => m.fullName)).toEqual([
      'سعد بن محمد القحطاني',
      'نورة القحطاني',
      'خالد سعد القحطاني',
      'سارة سعد القحطاني',
    ]);

    // Check age restriction: member_3 (Hijri 1438) & member_4 (Gregorian 2016) are under 18
    const refDate = new Date(Date.UTC(2026, 10, 14));
    expect(isMemberUnder18(withBackPage.familyMembers[0], refDate)).toBe(false);
    expect(isMemberUnder18(withBackPage.familyMembers[1], refDate)).toBe(false);
    expect(isMemberUnder18(withBackPage.familyMembers[2], refDate)).toBe(true);
    expect(isMemberUnder18(withBackPage.familyMembers[3], refDate)).toBe(true);

    // Selecting under-18 member as primary must be ignored
    const afterMinorClick = selectPrimaryFamilyMember(withBackPage, 'member_3');
    expect(afterMinorClick.primaryMemberId).toBe('member_1');

    // Selecting adult spouse (18+) as primary is allowed
    const afterAdultClick = selectPrimaryFamilyMember(withBackPage, 'member_2');
    expect(afterAdultClick.primaryMemberId).toBe('member_2');
    expect(afterAdultClick.fullName).toBe('نورة القحطاني');
  });

  it('deduplicates slightly different name variants of the cardholder and duplicate member entries', () => {
    const form = applyExtractedDataToForm(createEmptyGuestForm(), {
      documentType: 'family_register',
      fullName: 'عبدالرحيم بن علي بن سعيد القرشي المالكي',
      nameParts: {
        firstName: 'عبدالرحيم',
        fatherName: 'علي',
        grandfatherName: 'سعيد',
        familyName: 'المالكي',
      },
      documentNumber: '1008592030',
      nationality: null,
      sex: 'male',
      dateOfBirth: '1402/06/29',
      birthCalendar: 'hijri',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'عبدالرحيم بن علي بن سعيد القرشي',
          documentNumber: '',
          sex: 'male',
          dateOfBirth: '1402/06/29',
          birthCalendar: 'hijri',
          relationship: 'صاحب السجل',
        },
        {
          fullName: 'عبدالرحيم بن علي بن سعيد القرشي المالكي',
          documentNumber: '1008592030',
          sex: 'male',
          dateOfBirth: '1402/06/29',
          birthCalendar: 'hijri',
          relationship: 'صاحب السجل',
        },
        {
          fullName: 'أمل ضيف الله محمد المالكي',
          documentNumber: '1001352465',
          sex: 'female',
          dateOfBirth: '1399/07/01',
          birthCalendar: 'hijri',
          relationship: 'زوجة',
        },
      ],
      unreadableFields: [],
      warnings: [],
    });

    expect(form.familyMembers).toHaveLength(2);
    expect(form.familyMembers[0].fullName).toBe('عبدالرحيم بن علي بن سعيد القرشي المالكي');
    expect(form.familyMembers[0].documentNumber).toBe('1008592030');
    expect(form.familyMembers[1].fullName).toBe('أمل ضيف الله محمد المالكي');
  });

  it('locks extracted OCR fields while leaving missing fields editable', () => {
    const emptyForm = createEmptyGuestForm();
    const idExtracted: ExtractedDocumentData = {
      documentType: 'national_id',
      fullName: 'محمد عبدالله القحطاني',
      nameParts: { firstName: 'محمد', fatherName: 'عبدالله', grandfatherName: null, familyName: 'القحطاني' },
      documentNumber: '1012345678',
      nationality: 'سعودي',
      sex: 'male',
      dateOfBirth: '1410/03/04',
      birthCalendar: 'hijri',
      expiryDate: '1450/01/01',
      expiryCalendar: 'hijri',
      versionNumber: null, // unreadable from front
      familyMembers: [],
      unreadableFields: ['versionNumber'],
      warnings: [],
    };
    const idForm = applyExtractedDataToForm(emptyForm, idExtracted, false);
    const idLocks = deriveLockedFieldsFromExtraction(
      createEmptyLockedFields(),
      emptyForm,
      idForm,
      idExtracted,
      false
    );

    expect(idLocks.documentType).toBe(true);
    expect(idLocks.fullName).toBe(true);
    expect(idLocks.documentNumber).toBe(true);
    expect(idLocks.nationality).toBe(true);
    expect(idLocks.sex).toBe(true);
    expect(idLocks.dateOfBirth).toBe(true);
    expect(idLocks.expiryDate).toBe(true);
    expect(idLocks.versionNumber).toBe(false);

    // Family register: cardholder DOB is absent on card -> remains unlocked for wheel picker; dependent DOB is locked
    const famExtracted: ExtractedDocumentData = {
      documentType: 'family_register',
      fullName: 'سعد القحطاني',
      nameParts: { firstName: 'سعد', fatherName: null, grandfatherName: null, familyName: 'القحطاني' },
      documentNumber: '1099887766',
      nationality: 'سعودي',
      sex: 'male',
      dateOfBirth: null,
      birthCalendar: 'unknown',
      expiryDate: null,
      expiryCalendar: 'unknown',
      versionNumber: null,
      familyMembers: [
        {
          fullName: 'سعد القحطاني',
          documentNumber: '1099887766',
          sex: 'male',
          dateOfBirth: '',
          birthCalendar: 'unknown',
          relationship: 'صاحب السجل',
        },
        {
          fullName: 'نورة القحطاني',
          documentNumber: '1099887700',
          sex: 'female',
          dateOfBirth: '1412/05/06',
          birthCalendar: 'hijri',
          relationship: 'زوجة',
        },
      ],
      unreadableFields: [],
      warnings: [],
    };
    const famForm = applyExtractedDataToForm(emptyForm, famExtracted, false);
    const famLocks = deriveLockedFieldsFromExtraction(
      createEmptyLockedFields(),
      emptyForm,
      famForm,
      famExtracted,
      false
    );

    expect(famLocks.familyMembers['member_1']?.fullName).toBe(true);
    expect(famLocks.familyMembers['member_1']?.documentNumber).toBe(true);
    expect(famLocks.familyMembers['member_1']?.dateOfBirth).toBe(false);
    expect(famLocks.familyMembers['member_2']?.fullName).toBe(true);
    expect(famLocks.familyMembers['member_2']?.dateOfBirth).toBe(true);
  });
});

describe('Hotels Portal & QR Check-in helpers', () => {
  it('normalizes Saudi and Arabic-digit hotel reception phones for WhatsApp', () => {
    expect(normalizeHotelPhoneToWhatsApp('٠٥٥١٢٣٤٥٦٧')).toBe('966551234567');
    expect(normalizeHotelPhoneToWhatsApp('+966 50-123-4567')).toBe('966501234567');
    expect(normalizeHotelPhoneToWhatsApp('00966509876543')).toBe('966509876543');
  });

  it('evaluates hotel operational status and subscription expiry accurately', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const future = new Date('2026-07-01T12:00:00Z');
    const past = new Date('2026-05-01T12:00:00Z');

    expect(
      isHotelOperational({ status: 'approved', isActive: true, expiresAt: future }, now)
    ).toBe(true);
    expect(
      isHotelOperational({ status: 'pending', isActive: false, expiresAt: null }, now)
    ).toBe(false);
    expect(
      isHotelOperational({ status: 'suspended', isActive: false, expiresAt: future }, now)
    ).toBe(false);
    expect(
      isHotelOperational({ status: 'approved', isActive: true, expiresAt: past }, now)
    ).toBe(false);

    expect(isHotelExpired({ status: 'approved', expiresAt: past }, now)).toBe(true);
    expect(isHotelExpired({ status: 'approved', expiresAt: future }, now)).toBe(false);
    expect(isHotelExpired({ status: 'pending', expiresAt: past }, now)).toBe(false);
  });

  it('round-trips GuestFormData through buildCheckinPassportData and checkinSessionToGuestForm and formats hotel/room summary', () => {
    const form = {
      ...createEmptyGuestForm(),
      fullName: 'عبدالله سعيد الحربي',
      documentType: 'national_id' as const,
      documentNumber: '1012345678',
      nationality: 'سعودي',
      sex: 'male' as const,
      dateOfBirth: '1411/04/12',
      birthCalendar: 'hijri' as const,
      expiryDate: '1451/04/12',
      expiryCalendar: 'hijri' as const,
      versionNumber: '03',
      mobileNumber: '+966501112233',
      purposeOfVisit: 'business' as const,
      bookingSource: 'reception' as const,
    };

    const passportData = buildCheckinPassportData(form);
    const reconstructed = checkinSessionToGuestForm({
      id: 'sess_1',
      hotelId: 'hotel_1',
      hotelName: 'فندق لؤلؤة البحر',
      hotelOwnerUid: 'uid_owner',
      guestName: form.fullName,
      nationality: form.nationality,
      passportData,
      status: 'approved',
      roomNumber: '305',
      welcomeMessage: 'أهلاً بك في فندق لؤلؤة البحر، غرفتك رقم 305 جاهزة.',
      roomPrice: 500,
      discountedPrice: 400,
      discountPercent: 20,
      createdAt: new Date(),
      approvedAt: new Date(),
    });

    expect(reconstructed.fullName).toBe(form.fullName);
    expect(reconstructed.documentNumber).toBe(form.documentNumber);
    expect(reconstructed.versionNumber).toBe('03');
    expect(reconstructed.purposeOfVisit).toBe('business');

    const msg = buildWhatsAppMessage(reconstructed, [], '305', 'فندق لؤلؤة البحر', 400);
    expect(msg).toContain('الفندق / Hotel: فندق لؤلؤة البحر');
    expect(msg).toContain('رقم الغرفة / Room number: 305');
    expect(msg).toContain('سعر الغرفة / Room price: 400 ر.س / 400 SAR');
    expect(msg).not.toContain('20%');
  });

  it('requires hotel terms acceptance in Hotel QR mode while keeping general WhatsApp mode unaffected', () => {
    const form = {
      ...createEmptyGuestForm(),
      fullName: 'فهد عبدالعزيز السبيعي',
      documentType: 'national_id' as const,
      documentNumber: '1022334455',
      nationality: 'سعودي',
      dateOfBirth: '1410/02/15',
      birthCalendar: 'hijri' as const,
      versionNumber: '02',
      mobileNumber: '+966501234567',
      purposeOfVisit: 'tourism' as const,
      bookingSource: 'reception' as const,
    };

    const generalValid = validateGuestRequest(form, true);
    expect(generalValid.canOpenWhatsApp).toBe(true);
    expect(generalValid.missingRequiredFields).not.toContain('hotelTerms');

    const hotelMissingTerms = validateGuestRequest(form, true, true, false);
    expect(hotelMissingTerms.canOpenWhatsApp).toBe(false);
    expect(hotelMissingTerms.missingRequiredFields).toContain('hotelTerms');

    const hotelAcceptedTerms = validateGuestRequest(form, true, true, true);
    expect(hotelAcceptedTerms.canOpenWhatsApp).toBe(true);
    expect(hotelAcceptedTerms.missingRequiredFields).not.toContain('hotelTerms');
  });

  it('sanitizes decimal room prices and auto-calculates discount percentage accurately', () => {
    expect(sanitizeDecimalPriceInput('٥٠٠.٧٥')).toBe('500.75');
    expect(sanitizeDecimalPriceInput('400,50abc')).toBe('400.50');
    expect(parseValidPrice('500')).toBe(500);

    expect(calculateDiscountPercent(500, 400)).toBe(20);
    expect(calculateDiscountPercent(500, 500)).toBe(0);
    expect(calculateDiscountPercent(300, 200)).toBe(33.33);
    expect(calculateDiscountPercent(500, 600)).toBeNull();
    expect(calculateDiscountPercent(0, 0)).toBeNull();
  });
});

