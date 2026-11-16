import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HeaderBar } from '../src/components/HeaderBar';
import { getTranslations } from '../src/i18n';

describe('HeaderBar view isolation', () => {
  it('hides guest prep and app owner sections when opening the Hotels Portal view', () => {
    const t = getTranslations('ar');
    const html = renderToStaticMarkup(
      <HeaderBar
        lang="ar"
        t={t}
        viewMode="hotel"
        isQrGuestMode={false}
        onChangeView={vi.fn()}
        onToggleLanguage={vi.fn()}
        onClearAll={vi.fn()}
        hasSessionData={false}
      />
    );

    expect(t.appTitle).toBe('مهلي');
    expect(html).toContain(t.appTitle);
    expect(html).toContain(t.navHotelsPortal);
    expect(html).not.toContain(t.navGuestPrep);
    expect(html).not.toContain(t.navOwnerDashboard);
    expect(html).not.toContain('<nav');
  });

  it('shows all navigation sections on the default guest view without QR hotel isolation', () => {
    const t = getTranslations('ar');
    const html = renderToStaticMarkup(
      <HeaderBar
        lang="ar"
        t={t}
        viewMode="guest"
        isQrGuestMode={false}
        onChangeView={vi.fn()}
        onToggleLanguage={vi.fn()}
        onClearAll={vi.fn()}
        hasSessionData={false}
      />
    );

    expect(html).toContain(t.navGuestPrep);
    expect(html).toContain(t.navHotelsPortal);
    expect(html).toContain(t.navOwnerDashboard);
    expect(html).toContain('<nav');
  });

  it('hides navigation tabs in QR guest mode', () => {
    const t = getTranslations('ar');
    const html = renderToStaticMarkup(
      <HeaderBar
        lang="ar"
        t={t}
        viewMode="guest"
        isQrGuestMode={true}
        onChangeView={vi.fn()}
        onToggleLanguage={vi.fn()}
        onClearAll={vi.fn()}
        hasSessionData={false}
      />
    );

    expect(html).toContain(t.appTitle);
    expect(html).not.toContain(t.navHotelsPortal);
    expect(html).not.toContain(t.navOwnerDashboard);
    expect(html).not.toContain('<nav');
  });
});
