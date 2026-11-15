import type { BookingSourceId, VisitPurposeId } from '../types/guest';

export interface VisitPurposeConfigItem {
  id: VisitPurposeId;
  enabled: boolean;
}

/**
 * Operational list of visit purposes, configurable from app settings.
 * These are operational options and are not automatically mapped to Nazeel.
 */
export const DEFAULT_VISIT_PURPOSES: VisitPurposeConfigItem[] = [
  { id: 'tourism', enabled: true },
  { id: 'business', enabled: true },
  { id: 'family_friends', enabled: true },
  { id: 'medical', enabled: true },
  { id: 'hajj_umrah', enabled: true },
  { id: 'other', enabled: true },
];

export const BOOKING_SOURCES: BookingSourceId[] = ['booking_com', 'reception'];
