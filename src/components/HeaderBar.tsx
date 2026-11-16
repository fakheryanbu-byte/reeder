import { Building2, Globe, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import type { AppViewMode, Language } from '../types/guest';

interface HeaderBarProps {
  lang: Language;
  t: TranslationKeys;
  viewMode: AppViewMode;
  isQrGuestMode: boolean;
  onChangeView: (mode: AppViewMode) => void;
  onToggleLanguage: () => void;
  onClearAll: () => void;
  hasSessionData: boolean;
}

export interface HeaderNavigationState {
  showPortalNav: boolean;
  isIsolatedHotelView: boolean;
  isTitleClickable: boolean;
}

export function getHeaderNavigationState(
  viewMode: AppViewMode,
  isQrGuestMode: boolean
): HeaderNavigationState {
  const isIsolatedHotelView = viewMode === 'hotel' && !isQrGuestMode;
  const showPortalNav = !isQrGuestMode && viewMode !== 'hotel';
  return {
    showPortalNav,
    isIsolatedHotelView,
    isTitleClickable: showPortalNav,
  };
}

export function HeaderBar({
  t,
  viewMode,
  isQrGuestMode,
  onChangeView,
  onToggleLanguage,
  onClearAll,
  hasSessionData,
}: HeaderBarProps) {
  const navItems: { mode: AppViewMode; label: string; icon: typeof UserCheck }[] = [
    { mode: 'guest', label: t.navGuestPrep, icon: UserCheck },
    { mode: 'hotel', label: t.navHotelsPortal, icon: Building2 },
    { mode: 'owner', label: t.navOwnerDashboard, icon: ShieldCheck },
  ];

  const { showPortalNav, isIsolatedHotelView, isTitleClickable } =
    getHeaderNavigationState(viewMode, isQrGuestMode);

  return (
    <header className="sticky top-0 z-30 border-b border-[#2C2C2C]/10 bg-[#FAF7F2]/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {isIsolatedHotelView ? (
          <div className="inline-flex min-w-0 items-center gap-2 text-start whitespace-nowrap shrink-0">
            <span className="text-base font-bold tracking-tight text-[#2C2C2C] sm:text-lg">
              {t.appTitle}
            </span>
            <span className="text-xs text-[#685F58]" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C5338] sm:text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t.navHotelsPortal}</span>
            </span>
          </div>
        ) : !isTitleClickable ? (
          <span className="min-w-0 text-start text-base font-bold tracking-tight text-[#2C2C2C] whitespace-nowrap shrink-0 sm:text-lg">
            {t.appTitle}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onChangeView('guest')}
            className="min-w-0 text-start text-base font-bold tracking-tight text-[#2C2C2C] whitespace-nowrap shrink-0 sm:text-lg"
          >
            {t.appTitle}
          </button>
        )}

        {showPortalNav && (
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 rounded-xl border border-[#2C2C2C]/10 bg-[#F4EFEA] p-1 md:flex"
          >
            {navItems.map(({ mode, label, icon: Icon }) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeView(mode)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#2C2C2C] text-[#FAF7F2]'
                      : 'text-[#685F58] hover:text-[#2C2C2C]'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? 'text-[#E8A588]' : 'text-[#8C5338]'}`}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {viewMode === 'guest' && hasSessionData && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[#8C5338] transition-colors hover:bg-[#E8A588]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t.clearMyData}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLanguage}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3 py-2 text-xs font-semibold text-[#2C2C2C] transition-colors hover:bg-[#E8A588]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C58B6D] whitespace-nowrap shrink-0"
            aria-label={t.langToggle}
          >
            <Globe className="h-3.5 w-3.5 text-[#8C5338]" aria-hidden="true" />
            <span>{t.langToggle}</span>
          </button>
        </div>
      </div>

      {/* Compact single-row mobile navigation tabs */}
      {showPortalNav && (
        <nav
          aria-label="Mobile navigation"
          className="flex items-center gap-1.5 overflow-x-auto border-t border-[#2C2C2C]/8 bg-[#FAF7F2] px-4 py-1.5 md:hidden"
        >
          {navItems.map(({ mode, label, icon: Icon }) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeView(mode)}
                className={`inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#2C2C2C] text-[#FAF7F2]'
                    : 'border border-[#2C2C2C]/10 bg-[#F4EFEA] text-[#685F58]'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${active ? 'text-[#E8A588]' : 'text-[#8C5338]'}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
