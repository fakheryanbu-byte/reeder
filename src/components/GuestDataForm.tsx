import { AlertCircle, Check, Plus, Trash2, UserCheck, Users } from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import type {
  CalendarType,
  DocumentType,
  FamilyMember,
  GuestFormData,
  LockedFormFields,
  SexType,
} from '../types/guest';
import {
  getFieldVisibility,
  isMemberUnder18,
  normalizeDateInput,
  normalizeMobileInput,
  toAsciiDigits,
} from '../utils/documentRules';
import { DateWheelPicker } from './DateWheelPicker';

interface GuestDataFormProps {
  form: GuestFormData;
  lockedFields: LockedFormFields;
  missingFields: Set<string>;
  onChangeField: <K extends keyof GuestFormData>(key: K, value: GuestFormData[K]) => void;
  onChangeDocumentType: (nextType: DocumentType) => void;
  onSelectPrimaryMember: (memberId: string) => void;
  onToggleAccompanyingMember: (memberId: string) => void;
  onUpdateFamilyMember: (memberId: string, patch: Partial<FamilyMember>) => void;
  onAddFamilyMember: () => void;
  onRemoveFamilyMember: (memberId: string) => void;
  t: TranslationKeys;
}

export function GuestDataForm({
  form,
  lockedFields,
  missingFields,
  onChangeField,
  onChangeDocumentType,
  onSelectPrimaryMember,
  onToggleAccompanyingMember,
  onUpdateFamilyMember,
  onAddFamilyMember,
  onRemoveFamilyMember,
  t,
}: GuestDataFormProps) {
  const vis = getFieldVisibility(form.documentType);

  const hasActivePrimaryMemberCard =
    vis.showFamilyMembers &&
    form.familyMembers.length > 0 &&
    Boolean(form.primaryMemberId);

  const inputClass = (fieldKey: string, isLocked = false) =>
    `min-h-[48px] w-full rounded-xl border px-3.5 py-2.5 text-sm text-[#2C2C2C] transition-colors ${
      isLocked
        ? 'cursor-default border-[#2C2C2C]/10 bg-[#F4EFEA]/85 focus:outline-none'
        : missingFields.has(fieldKey)
          ? 'border-[#C58B6D] bg-[#E8A588]/15 focus:outline-none focus:ring-2 focus:ring-[#C58B6D]'
          : 'border-[#2C2C2C]/15 bg-[#FFFFFF] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]'
    }`;

  const renderLabel = (label: string, fieldKey: string, required = false) => (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-sm font-semibold text-[#2C2C2C]">
        {label}
        {required && <span className="ms-1 text-[#8C5338]">{t.requiredMark}</span>}
      </label>
      {missingFields.has(fieldKey) && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C5338]">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.missingBadge}</span>
        </span>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby="data-section-title"
      className="rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-6"
    >
      <div className="mb-4">
        <h2
          id="data-section-title"
          className="text-lg font-bold text-[#2C2C2C] sm:text-xl"
        >
          {t.sectionDataTitle}
        </h2>
      </div>

      <div className="space-y-4">
        {/* Document Type */}
        <div>
          {renderLabel(t.fieldDocumentType, 'documentType', true)}
          <select
            value={form.documentType}
            disabled={Boolean(lockedFields.documentType)}
            onChange={(e) => {
              if (!lockedFields.documentType) {
                onChangeDocumentType(e.target.value as DocumentType);
              }
            }}
            className={inputClass('documentType', Boolean(lockedFields.documentType))}
          >
            <option value="unknown">{t.docTypes.unknown}</option>
            <option value="national_id">{t.docTypes.national_id}</option>
            <option value="iqama">{t.docTypes.iqama}</option>
            <option value="passport">{t.docTypes.passport}</option>
            <option value="family_register">{t.docTypes.family_register}</option>
          </select>
        </div>

        {/* Family Register Member Selection */}
        {vis.showFamilyMembers && (
          <div className="border-y border-[#2C2C2C]/10 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#2C2C2C]">
                <Users className="h-4 w-4 text-[#8C5338]" aria-hidden="true" />
                <span>{t.familySectionTitle}</span>
              </h3>
              <button
                type="button"
                onClick={onAddFamilyMember}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{t.familyAddMember}</span>
              </button>
            </div>

            {form.familyMembers.length === 0 ? (
              <p className="m-0 rounded-xl bg-[#F4EFEA] p-3 text-xs text-[#685F58]">
                {t.familyNoMembers}
              </p>
            ) : (
              <div className="divide-y divide-[#2C2C2C]/10">
                {form.familyMembers.map((member, index) => {
                  const isPrimary = form.primaryMemberId === member.id;
                  const isAccompanying =
                    !isPrimary && form.accompanyingMemberIds.includes(member.id);
                  const under18 = isMemberUnder18(member);
                  const orderLabel =
                    index === 0 ? t.familyCardholderBadge : `(${index})`;
                  const memberLock = lockedFields.familyMembers[member.id] ?? {};

                  return (
                    <div
                      key={member.id}
                      className={`space-y-2.5 py-3.5 first:pt-0 last:pb-0 ${
                        isAccompanying ? 'rounded-2xl bg-[#2E6B47]/[0.05] px-3 my-1' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto wheel-scrollbar-hidden">
                          <span className="inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-lg bg-[#2C2C2C]/8 px-2 py-1 text-[11px] font-bold text-[#2C2C2C]">
                            {orderLabel}
                          </span>

                          {!under18 ? (
                            <button
                              type="button"
                              onClick={() => onSelectPrimaryMember(member.id)}
                              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                                isPrimary
                                  ? 'bg-[#2C2C2C] text-[#FAF7F2]'
                                  : 'border border-[#2C2C2C]/15 bg-[#F4EFEA] text-[#2C2C2C] hover:bg-[#E8A588]/25'
                              }`}
                            >
                              <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>{isPrimary ? t.familyIsPrimary : t.familySelectPrimary}</span>
                            </button>
                          ) : (
                            <span className="inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-xl border border-[#2C2C2C]/10 bg-[#F4EFEA] px-2.5 py-1.5 text-[11px] font-semibold text-[#685F58] sm:text-xs">
                              {t.familyUnder18Badge}
                            </span>
                          )}

                          {!isPrimary && (
                            <label
                              className={`inline-flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                                isAccompanying
                                  ? 'border-[#2E6B47] bg-[#2E6B47]/12 text-[#2C2C2C]'
                                  : 'border-[#2C2C2C]/15 bg-[#F4EFEA]/70 text-[#2C2C2C] hover:bg-[#E8A588]/15'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAccompanying}
                                onChange={() => onToggleAccompanyingMember(member.id)}
                                className="sr-only"
                              />
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                  isAccompanying
                                    ? 'border-[#2E6B47] bg-[#2E6B47] text-[#FAF7F2]'
                                    : 'border-[#2C2C2C]/30 bg-[#FFFFFF] text-transparent'
                                }`}
                                aria-hidden="true"
                              >
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                              <span>{t.familyAccompanying}</span>
                            </label>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoveFamilyMember(member.id)}
                          className="inline-flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-[11px] font-medium text-[#9E3B33] hover:bg-[#9E3B33]/10 sm:text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{t.familyRemoveMember}</span>
                        </button>
                      </div>

                      {/* Row 1: Full Name + Relationship in one unified box with divider */}
                      <div
                        className={`flex items-stretch overflow-hidden rounded-xl border transition-colors ${
                          (isPrimary || isAccompanying) && !member.fullName.trim()
                            ? 'border-[#C58B6D] bg-[#E8A588]/15'
                            : memberLock.fullName && memberLock.relationship
                              ? 'border-[#2C2C2C]/10 bg-[#F4EFEA]/85'
                              : 'border-[#2C2C2C]/15 bg-[#FFFFFF]'
                        }`}
                      >
                        <input
                          type="text"
                          value={member.fullName}
                          readOnly={Boolean(memberLock.fullName)}
                          aria-readonly={Boolean(memberLock.fullName)}
                          onChange={(e) => {
                            if (!memberLock.fullName) {
                              onUpdateFamilyMember(member.id, { fullName: e.target.value });
                            }
                          }}
                          placeholder={t.familyMemberName}
                          aria-label={t.familyMemberName}
                          className={`min-h-[44px] min-w-0 flex-1 px-3 py-2 text-xs font-medium text-[#2C2C2C] placeholder:text-[#685F58]/70 focus:outline-none ${
                            memberLock.fullName ? 'cursor-default bg-[#F4EFEA]/85' : 'bg-transparent'
                          }`}
                        />
                        <div className="w-px self-stretch bg-[#2C2C2C]/15" aria-hidden="true" />
                        <input
                          type="text"
                          value={member.relationship}
                          readOnly={Boolean(memberLock.relationship)}
                          aria-readonly={Boolean(memberLock.relationship)}
                          onChange={(e) => {
                            if (!memberLock.relationship) {
                              onUpdateFamilyMember(member.id, { relationship: e.target.value });
                            }
                          }}
                          placeholder={t.familyMemberRelation}
                          aria-label={t.familyMemberRelation}
                          className={`min-h-[44px] w-[96px] shrink-0 px-2.5 py-2 text-center text-xs text-[#685F58] placeholder:text-[#685F58]/70 focus:outline-none sm:w-[128px] ${
                            memberLock.relationship
                              ? 'cursor-default bg-[#F4EFEA]/85'
                              : 'bg-transparent'
                          }`}
                        />
                      </div>

                      {index === 0 ? (
                        <>
                          {/* Cardholder ID Number above DateWheelPicker */}
                          <div
                            className={`overflow-hidden rounded-xl border transition-colors ${
                              isPrimary && !member.documentNumber.trim()
                                ? 'border-[#C58B6D] bg-[#E8A588]/15'
                                : memberLock.documentNumber
                                  ? 'border-[#2C2C2C]/10 bg-[#F4EFEA]/85'
                                  : 'border-[#2C2C2C]/15 bg-[#FFFFFF]'
                            }`}
                          >
                            <input
                              type="text"
                              dir="ltr"
                              value={member.documentNumber}
                              readOnly={Boolean(memberLock.documentNumber)}
                              aria-readonly={Boolean(memberLock.documentNumber)}
                              onChange={(e) => {
                                if (!memberLock.documentNumber) {
                                  onUpdateFamilyMember(member.id, {
                                    documentNumber: toAsciiDigits(e.target.value),
                                  });
                                }
                              }}
                              placeholder={t.familyMemberDocNum}
                              aria-label={t.familyMemberDocNum}
                              className={`ltr-field tabular-nums min-h-[44px] w-full bg-transparent px-3 py-2 text-xs text-[#2C2C2C] placeholder:text-[#685F58]/70 focus:outline-none ${
                                memberLock.documentNumber ? 'cursor-default' : ''
                              }`}
                            />
                          </div>

                          {memberLock.dateOfBirth ? (
                            <div className="overflow-hidden rounded-xl border border-[#2C2C2C]/10 bg-[#F4EFEA]/85 px-3 py-2">
                              <span className="block text-[10px] font-semibold text-[#685F58]">
                                {t.familyMemberDob}
                              </span>
                              <input
                                type="text"
                                dir="ltr"
                                value={member.dateOfBirth}
                                readOnly
                                aria-readonly="true"
                                aria-label={t.familyMemberDob}
                                className="ltr-field tabular-nums min-h-[28px] w-full cursor-default bg-transparent text-xs font-medium text-[#2C2C2C] focus:outline-none"
                              />
                            </div>
                          ) : (
                            <DateWheelPicker
                              value={member.dateOfBirth}
                              calendar={member.birthCalendar}
                              defaultCalendar="hijri"
                              dobMissing={(isPrimary || isAccompanying) && !member.dateOfBirth.trim()}
                              calendarMissing={isPrimary && member.birthCalendar === 'unknown'}
                              dobLabel={t.familyMemberDob}
                              calendarLabel={t.fieldCalendar}
                              requiredMark={isPrimary || isAccompanying ? t.requiredMark : ''}
                              missingBadge={t.missingBadge}
                              onChange={(formattedDate, nextCal) =>
                                onUpdateFamilyMember(member.id, {
                                  dateOfBirth: formattedDate,
                                  birthCalendar: nextCal,
                                })
                              }
                              t={t}
                            />
                          )}
                        </>
                      ) : (
                        /* Row 2 for dependents: Date of Birth + Record Number on the same line with divider */
                        <div
                          className={`flex items-stretch overflow-hidden rounded-xl border bg-[#FFFFFF] transition-colors ${
                            ((isPrimary || isAccompanying) && !member.dateOfBirth.trim()) ||
                            (isPrimary && !member.documentNumber.trim())
                              ? 'border-[#C58B6D]'
                              : 'border-[#2C2C2C]/15'
                          }`}
                        >
                          <div
                            className={`flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5 ${
                              (isPrimary || isAccompanying) && !member.dateOfBirth.trim()
                                ? 'bg-[#E8A588]/15'
                                : memberLock.dateOfBirth
                                  ? 'bg-[#F4EFEA]/85'
                                  : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-semibold text-[#685F58]">
                                {t.fieldDateOfBirth}
                                {(isPrimary || isAccompanying) && (
                                  <span className="ms-0.5 text-[#8C5338]">{t.requiredMark}</span>
                                )}
                              </span>
                              {(isPrimary || isAccompanying) && !member.dateOfBirth.trim() && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#8C5338]">
                                  <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />
                                  <span>{t.missingBadge}</span>
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              dir="ltr"
                              value={member.dateOfBirth}
                              readOnly={Boolean(memberLock.dateOfBirth)}
                              aria-readonly={Boolean(memberLock.dateOfBirth)}
                              onChange={(e) => {
                                if (memberLock.dateOfBirth) return;
                                const nextDob = toAsciiDigits(e.target.value);
                                const { inferredCalendar } = normalizeDateInput(nextDob);
                                const patch: Partial<FamilyMember> = { dateOfBirth: nextDob };
                                if (inferredCalendar) {
                                  patch.birthCalendar = inferredCalendar;
                                }
                                onUpdateFamilyMember(member.id, patch);
                              }}
                              onBlur={() => {
                                if (memberLock.dateOfBirth) return;
                                const { formatted, inferredCalendar } = normalizeDateInput(
                                  member.dateOfBirth
                                );
                                const patch: Partial<FamilyMember> = {};
                                if (formatted !== member.dateOfBirth) {
                                  patch.dateOfBirth = formatted;
                                }
                                if (inferredCalendar) {
                                  patch.birthCalendar = inferredCalendar;
                                }
                                if (Object.keys(patch).length > 0) {
                                  onUpdateFamilyMember(member.id, patch);
                                }
                              }}
                              placeholder={t.fieldDatePlaceholder}
                              aria-label={t.familyMemberDob}
                              className={`ltr-field tabular-nums min-h-[28px] w-full bg-transparent text-xs font-medium text-[#2C2C2C] placeholder:text-[#685F58]/60 focus:outline-none ${
                                memberLock.dateOfBirth ? 'cursor-default' : ''
                              }`}
                            />
                          </div>

                          <div className="w-px self-stretch bg-[#2C2C2C]/15" aria-hidden="true" />

                          <div
                            className={`flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5 ${
                              isPrimary && !member.documentNumber.trim()
                                ? 'bg-[#E8A588]/15'
                                : memberLock.documentNumber
                                  ? 'bg-[#F4EFEA]/85'
                                  : ''
                            }`}
                          >
                            <span className="text-[10px] font-semibold text-[#685F58]">
                              {t.familyMemberDocNum}
                              {isPrimary && (
                                <span className="ms-0.5 text-[#8C5338]">{t.requiredMark}</span>
                              )}
                            </span>
                            <input
                              type="text"
                              dir="ltr"
                              value={member.documentNumber}
                              readOnly={Boolean(memberLock.documentNumber)}
                              aria-readonly={Boolean(memberLock.documentNumber)}
                              onChange={(e) => {
                                if (!memberLock.documentNumber) {
                                  onUpdateFamilyMember(member.id, {
                                    documentNumber: toAsciiDigits(e.target.value),
                                  });
                                }
                              }}
                              placeholder={t.fieldDocumentNumberPlaceholder}
                              aria-label={t.familyMemberDocNum}
                              className={`ltr-field tabular-nums min-h-[28px] w-full bg-transparent text-xs font-medium text-[#2C2C2C] placeholder:text-[#685F58]/60 focus:outline-none ${
                                memberLock.documentNumber ? 'cursor-default' : ''
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!hasActivePrimaryMemberCard && (
          <>
            {/* Full Name */}
            <div>
              {renderLabel(t.fieldFullName, 'fullName', true)}
              <input
                type="text"
                value={form.fullName}
                readOnly={Boolean(lockedFields.fullName)}
                aria-readonly={Boolean(lockedFields.fullName)}
                onChange={(e) => {
                  if (!lockedFields.fullName) {
                    onChangeField('fullName', e.target.value);
                  }
                }}
                placeholder={t.fieldFullNamePlaceholder}
                className={inputClass('fullName', Boolean(lockedFields.fullName))}
              />
            </div>

            {/* Document Number + Date of Birth (same row) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                {renderLabel(t.fieldDocumentNumber, 'documentNumber', true)}
                <input
                  type="text"
                  dir="ltr"
                  inputMode="text"
                  value={form.documentNumber}
                  readOnly={Boolean(lockedFields.documentNumber)}
                  aria-readonly={Boolean(lockedFields.documentNumber)}
                  onChange={(e) => {
                    if (!lockedFields.documentNumber) {
                      onChangeField('documentNumber', toAsciiDigits(e.target.value));
                    }
                  }}
                  placeholder={t.fieldDocumentNumberPlaceholder}
                  className={`${inputClass('documentNumber', Boolean(lockedFields.documentNumber))} ltr-field tabular-nums`}
                />
              </div>

              <div>
                {renderLabel(t.fieldDateOfBirth, 'dateOfBirth', true)}
                <input
                  type="text"
                  dir="ltr"
                  value={form.dateOfBirth}
                  readOnly={Boolean(lockedFields.dateOfBirth)}
                  aria-readonly={Boolean(lockedFields.dateOfBirth)}
                  onChange={(e) => {
                    if (lockedFields.dateOfBirth) return;
                    const nextDob = toAsciiDigits(e.target.value);
                    onChangeField('dateOfBirth', nextDob);
                    const { inferredCalendar } = normalizeDateInput(nextDob);
                    if (inferredCalendar) {
                      onChangeField('birthCalendar', inferredCalendar);
                    }
                  }}
                  onBlur={() => {
                    if (lockedFields.dateOfBirth) return;
                    const { formatted, inferredCalendar } = normalizeDateInput(form.dateOfBirth);
                    if (formatted !== form.dateOfBirth) {
                      onChangeField('dateOfBirth', formatted);
                    }
                    if (inferredCalendar) {
                      onChangeField('birthCalendar', inferredCalendar);
                    }
                  }}
                  placeholder={t.fieldDatePlaceholder}
                  className={`${inputClass('dateOfBirth', Boolean(lockedFields.dateOfBirth))} ltr-field tabular-nums`}
                />
              </div>
            </div>

            {/* Nationality + Sex (same row) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                {renderLabel(t.fieldNationality, 'nationality', true)}
                <input
                  type="text"
                  value={form.nationality}
                  readOnly={Boolean(lockedFields.nationality)}
                  aria-readonly={Boolean(lockedFields.nationality)}
                  onChange={(e) => {
                    if (!lockedFields.nationality) {
                      onChangeField('nationality', e.target.value);
                    }
                  }}
                  placeholder={t.fieldNationalityPlaceholder}
                  className={inputClass('nationality', Boolean(lockedFields.nationality))}
                />
              </div>

              <div>
                {renderLabel(t.fieldSex, 'sex', false)}
                <select
                  value={form.sex}
                  disabled={Boolean(lockedFields.sex)}
                  onChange={(e) => {
                    if (!lockedFields.sex) {
                      onChangeField('sex', e.target.value as SexType);
                    }
                  }}
                  className={inputClass('sex', Boolean(lockedFields.sex))}
                >
                  <option value="">{t.sexSelect}</option>
                  <option value="male">{t.sexMale}</option>
                  <option value="female">{t.sexFemale}</option>
                </select>
              </div>
            </div>

          </>
        )}

        {/* Expiry Date + Version Number (same row when both apply) */}
        {(vis.showExpiryDate || vis.showVersionNumber) && (
          <div>
            <div
              className={`grid gap-3 sm:gap-4 ${
                vis.showExpiryDate && vis.showVersionNumber ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {vis.showExpiryDate && (
                <div>
                  {renderLabel(t.fieldExpiryDate, 'expiryDate', false)}
                  <input
                    type="text"
                    dir="ltr"
                    value={form.expiryDate}
                    readOnly={Boolean(lockedFields.expiryDate)}
                    aria-readonly={Boolean(lockedFields.expiryDate)}
                    onChange={(e) => {
                      if (lockedFields.expiryDate) return;
                      const nextExpiry = toAsciiDigits(e.target.value);
                      onChangeField('expiryDate', nextExpiry);
                      const { inferredCalendar } = normalizeDateInput(nextExpiry);
                      if (inferredCalendar) {
                        onChangeField('expiryCalendar', inferredCalendar);
                      }
                    }}
                    onBlur={() => {
                      if (lockedFields.expiryDate) return;
                      const { formatted, inferredCalendar } = normalizeDateInput(form.expiryDate);
                      if (formatted !== form.expiryDate) {
                        onChangeField('expiryDate', formatted);
                      }
                      if (inferredCalendar) {
                        onChangeField('expiryCalendar', inferredCalendar);
                      }
                    }}
                    placeholder={t.fieldDatePlaceholder}
                    className={`${inputClass('expiryDate', Boolean(lockedFields.expiryDate))} ltr-field tabular-nums`}
                  />
                </div>
              )}

              {vis.showVersionNumber && (
                <div>
                  {renderLabel(t.fieldVersionNumber, 'versionNumber', vis.requireVersionNumber)}
                  <input
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    value={form.versionNumber}
                    readOnly={Boolean(lockedFields.versionNumber)}
                    aria-readonly={Boolean(lockedFields.versionNumber)}
                    onChange={(e) => {
                      if (!lockedFields.versionNumber) {
                        onChangeField('versionNumber', toAsciiDigits(e.target.value));
                      }
                    }}
                    placeholder={t.fieldVersionPlaceholder}
                    className={`${inputClass('versionNumber', Boolean(lockedFields.versionNumber))} ltr-field tabular-nums`}
                  />
                </div>
              )}
            </div>
            {vis.showVersionNumber && (
              <p className="m-0 mt-1.5 text-xs text-[#685F58]">{t.versionHelperText}</p>
            )}
          </div>
        )}

        {/* Border Number (Passport only) */}
        {vis.showBorderNumber && (
          <div className="rounded-2xl border border-[#C58B6D]/40 bg-[#E8A588]/10 p-3.5">
            {renderLabel(t.fieldBorderNumber, 'borderNumber', !form.borderNumberUnknown)}
            <input
              type="text"
              dir="ltr"
              inputMode="numeric"
              disabled={form.borderNumberUnknown}
              value={form.borderNumber}
              onChange={(e) => onChangeField('borderNumber', toAsciiDigits(e.target.value))}
              placeholder={t.fieldBorderPlaceholder}
              className={`${inputClass('borderNumber')} ltr-field tabular-nums disabled:opacity-50`}
            />
            <p className="m-0 mt-1.5 text-xs font-medium text-[#8C5338]">
              {t.borderHelperText}
            </p>
            <label className="mt-2.5 flex min-h-[44px] cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={form.borderNumberUnknown}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChangeField('borderNumberUnknown', checked);
                  if (checked) {
                    onChangeField('borderNumber', '');
                  }
                }}
                className="h-5 w-5 shrink-0 accent-[#C58B6D]"
              />
              <span className="text-xs font-semibold text-[#2C2C2C] sm:text-sm">
                {t.borderUnknownCheckbox}
              </span>
            </label>
          </div>
        )}

        {/* Mobile Number */}
        <div>
          {renderLabel(t.fieldMobileNumber, 'mobileNumber', true)}
          <input
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={form.mobileNumber}
            onChange={(e) => onChangeField('mobileNumber', toAsciiDigits(e.target.value))}
            onBlur={() => {
              const normalized = normalizeMobileInput(form.mobileNumber);
              if (normalized !== form.mobileNumber) {
                onChangeField('mobileNumber', normalized);
              }
            }}
            placeholder={t.fieldMobilePlaceholder}
            className={`${inputClass('mobileNumber')} ltr-field tabular-nums`}
          />
          <p className="m-0 mt-1.5 text-xs text-[#685F58]">{t.mobileHelperText}</p>
        </div>
      </div>
    </section>
  );
}
