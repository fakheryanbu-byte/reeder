export type Language = 'ar' | 'en';

export type AppViewMode = 'guest' | 'hotel' | 'owner';

export type HotelStatus = 'pending' | 'approved' | 'suspended';

export interface HotelRecord {
  id: string;
  name: string;
  ownerUid: string;
  status: HotelStatus;
  isActive: boolean;
  expiresAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  termsText?: string;
}

export interface HotelPrivateInfo {
  hotelId: string;
  ownerUid: string;
  email: string;
  ownerEmail: string;
  receptionPhone: string;
  updatedAt: Date | null;
}

export interface HotelWithPrivate extends HotelRecord {
  email?: string;
  ownerEmail?: string;
  receptionPhone?: string;
}

export type DocumentType =
  | 'national_id'
  | 'iqama'
  | 'passport'
  | 'family_register'
  | 'unknown';

export type CalendarType = 'hijri' | 'gregorian' | 'unknown';

export type SexType = 'male' | 'female' | '';

export type VisitPurposeId =
  | 'tourism'
  | 'business'
  | 'family_friends'
  | 'medical'
  | 'hajj_umrah'
  | 'other';

export type BookingSourceId = 'booking_com' | 'reception';

export interface NameParts {
  firstName: string | null;
  fatherName: string | null;
  grandfatherName: string | null;
  familyName: string | null;
}

export interface FamilyMember {
  id: string;
  fullName: string;
  nameParts?: NameParts;
  documentNumber: string;
  sex: SexType;
  dateOfBirth: string;
  birthCalendar: CalendarType;
  relationship: string;
}

export interface ExtractedDocumentData {
  documentType: DocumentType;
  fullName: string | null;
  nameParts: NameParts;
  documentNumber: string | null;
  nationality: string | null;
  sex: SexType | null;
  dateOfBirth: string | null;
  birthCalendar: CalendarType | null;
  expiryDate: string | null;
  expiryCalendar: CalendarType | null;
  versionNumber: string | null;
  familyMembers: Omit<FamilyMember, 'id'>[];
  unreadableFields: string[];
  warnings: string[];
}

export interface GuestFormData {
  fullName: string;
  nameParts: NameParts;
  documentType: DocumentType;
  documentNumber: string;
  nationality: string;
  sex: SexType;
  dateOfBirth: string;
  birthCalendar: CalendarType;
  expiryDate: string;
  expiryCalendar: CalendarType;
  versionNumber: string;
  borderNumber: string;
  borderNumberUnknown: boolean;
  mobileNumber: string;
  // Family register selections
  familyMembers: FamilyMember[];
  primaryMemberId: string | null;
  accompanyingMemberIds: string[];
  // Visit & Booking (always chosen manually by guest)
  purposeOfVisit: VisitPurposeId | '';
  otherPurposeDetail: string;
  bookingSource: BookingSourceId | '';
  bookingReference: string;
}

export interface DocumentImageSlot {
  id: 'front' | 'back';
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface LockedMemberFields {
  fullName?: boolean;
  relationship?: boolean;
  documentNumber?: boolean;
  dateOfBirth?: boolean;
}

export interface LockedFormFields {
  documentType?: boolean;
  fullName?: boolean;
  documentNumber?: boolean;
  nationality?: boolean;
  sex?: boolean;
  dateOfBirth?: boolean;
  expiryDate?: boolean;
  versionNumber?: boolean;
  familyMembers: Record<string, LockedMemberFields>;
}

export type ValidationFieldKey =
  | keyof GuestFormData
  | 'declaration'
  | 'hotelTerms'
  | 'accompanyingMemberBirthDates'
  | 'accompanyingMemberNames';

export interface ValidationIssue {
  field: ValidationFieldKey;
  messageKey: string;
}

export interface ValidationResult {
  canOpenWhatsApp: boolean;
  isDataComplete: boolean;
  missingRequiredFields: ValidationFieldKey[];
  missingNotesAr: string[];
  missingNotesEn: string[];
}

export type CheckinSessionStatus = 'pending' | 'approved' | 'cancelled';

export interface CheckinPassportData {
  documentType: DocumentType;
  documentNumber: string;
  sex: SexType;
  dateOfBirth: string;
  birthCalendar: CalendarType;
  expiryDate: string;
  expiryCalendar: CalendarType;
  versionNumber: string;
  borderNumber: string;
  borderNumberUnknown: boolean;
  mobileNumber: string;
  familyMembers: FamilyMember[];
  primaryMemberId: string | null;
  accompanyingMemberIds: string[];
  purposeOfVisit: VisitPurposeId | '';
  otherPurposeDetail: string;
  bookingSource: BookingSourceId | '';
  bookingReference: string;
}

export interface CheckinSessionRecord {
  id: string;
  hotelId: string;
  hotelName: string;
  hotelOwnerUid: string;
  guestName: string;
  nationality: string;
  passportData: CheckinPassportData;
  status: CheckinSessionStatus;
  roomNumber: string | null;
  welcomeMessage: string | null;
  roomPrice: number | null;
  discountedPrice: number | null;
  discountPercent: number | null;
  createdAt: Date | null;
  approvedAt: Date | null;
  cancelledAt?: Date | null;
}
