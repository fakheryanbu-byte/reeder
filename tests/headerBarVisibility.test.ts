import { describe, expect, it } from 'vitest';
import { getHeaderNavigationState } from '../src/components/HeaderBar';

describe('HeaderBar navigation isolation', () => {
  it('hides guest prep and app owner navigation on the Hotels Portal page', () => {
    expect(getHeaderNavigationState('hotel', false)).toEqual({
      showPortalNav: false,
      isIsolatedHotelView: true,
      isTitleClickable: false,
    });
  });

  it('hides portal navigation in QR guest check-in mode', () => {
    expect(getHeaderNavigationState('guest', true)).toEqual({
      showPortalNav: false,
      isIsolatedHotelView: false,
      isTitleClickable: false,
    });
  });

  it('keeps portal navigation visible on default guest and app owner views', () => {
    expect(getHeaderNavigationState('guest', false)).toEqual({
      showPortalNav: true,
      isIsolatedHotelView: false,
      isTitleClickable: true,
    });
    expect(getHeaderNavigationState('owner', false)).toEqual({
      showPortalNav: true,
      isIsolatedHotelView: false,
      isTitleClickable: true,
    });
  });
});
