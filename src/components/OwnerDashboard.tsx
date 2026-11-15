import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { TranslationKeys } from '../i18n/ar';
import {
  approveOrRenewHotel,
  deleteHotel,
  reactivateHotel,
  subscribeToAllHotelsForAdmin,
  suspendHotel,
} from '../services/hotels';
import type { HotelWithPrivate, Language } from '../types/guest';
import { isHotelExpired, isHotelOperational } from '../utils/documentRules';

interface OwnerDashboardProps {
  lang: Language;
  t: TranslationKeys;
  adminEmail: string | null;
  onSignOut: () => Promise<void>;
}

export function OwnerDashboard({
  lang,
  t,
  adminEmail,
  onSignOut,
}: OwnerDashboardProps) {
  const [hotels, setHotels] = useState<HotelWithPrivate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'stopped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [busyHotelId, setBusyHotelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToAllHotelsForAdmin(
      (list) => {
        setHotels(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Failed to load hotels.');
      }
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    let pending = 0;
    let active = 0;
    let stopped = 0;
    for (const h of hotels) {
      if (h.status === 'pending') pending += 1;
      else if (isHotelOperational(h)) active += 1;
      else stopped += 1;
    }
    return {
      total: hotels.length,
      pending,
      active,
      stopped,
    };
  }, [hotels]);

  const filteredHotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hotels.filter((h) => {
      if (filter === 'pending' && h.status !== 'pending') return false;
      if (filter === 'active' && !isHotelOperational(h)) return false;
      if (filter === 'stopped' && (h.status === 'pending' || isHotelOperational(h))) {
        return false;
      }
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        (h.email ?? '').toLowerCase().includes(q) ||
        (h.receptionPhone ?? '').toLowerCase().includes(q)
      );
    });
  }, [hotels, filter, searchQuery]);

  const handleAction = async (hotelId: string, fn: () => Promise<void>) => {
    setBusyHotelId(hotelId);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusyHotelId(null);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary Metrics */}
      <section className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#2C2C2C] sm:text-2xl">
              {t.ownerDashboardTitle}
            </h2>
            <p className="mt-1 text-sm text-[#685F58]">{t.ownerDashboardDesc}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {adminEmail && (
              <span className="ltr-field text-xs font-medium text-[#685F58]">
                {adminEmail}
              </span>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3.5 py-2 text-xs font-semibold text-[#2C2C2C] hover:bg-[#E8A588]/20 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.adminSignOutButton}</span>
            </button>
          </div>
        </div>

        {/* 4-column flat stats strip */}
        <dl className="mt-5 grid grid-cols-2 divide-y divide-[#2C2C2C]/10 border-t border-[#2C2C2C]/10 pt-4 sm:grid-cols-4 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          <div className="px-3 py-2">
            <dt className="text-xs font-medium text-[#685F58]">{t.ownerMetricTotal}</dt>
            <dd className="tabular-nums mt-1 text-2xl font-bold text-[#2C2C2C]">
              {stats.total}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-xs font-medium text-[#8C5338]">{t.ownerMetricPending}</dt>
            <dd className="tabular-nums mt-1 text-2xl font-bold text-[#8C5338]">
              {stats.pending}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-xs font-medium text-[#2E6B47]">{t.ownerMetricActive}</dt>
            <dd className="tabular-nums mt-1 text-2xl font-bold text-[#2E6B47]">
              {stats.active}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-xs font-medium text-[#9E3B33]">{t.ownerMetricStopped}</dt>
            <dd className="tabular-nums mt-1 text-2xl font-bold text-[#9E3B33]">
              {stats.stopped}
            </dd>
          </div>
        </dl>

        {/* Controls Bar: Filters + Search + Subscription Duration */}
        <div className="mt-5 flex flex-col gap-3 border-t border-[#2C2C2C]/10 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap rounded-xl bg-[#F4EFEA] p-1">
            {(
              [
                ['all', t.ownerFilterAll],
                ['pending', t.ownerFilterPending],
                ['active', t.ownerFilterActive],
                ['stopped', t.ownerFilterStopped],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  filter === key
                    ? 'bg-[#FFFFFF] text-[#2C2C2C] shadow-sm'
                    : 'text-[#685F58] hover:text-[#2C2C2C]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#685F58]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.ownerSearchPlaceholder}
                className="min-h-[44px] w-full rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] pe-3 ps-9 text-sm text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="owner-duration-select"
                className="text-xs font-semibold text-[#685F58] whitespace-nowrap"
              >
                {t.ownerDurationLabel}
              </label>
              <select
                id="owner-duration-select"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF] px-3 text-xs font-semibold text-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-[#C58B6D]"
              >
                <option value={30}>{t.ownerDuration30}</option>
                <option value={90}>{t.ownerDuration90}</option>
                <option value={365}>{t.ownerDuration365}</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-[#9E3B33]/30 bg-[#9E3B33]/10 p-4 text-sm text-[#9E3B33]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="m-0 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-10">
          <Loader2 className="h-7 w-7 animate-spin text-[#8C5338]" aria-hidden="true" />
        </div>
      ) : filteredHotels.length === 0 ? (
        <div className="rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-10 text-center shadow-[var(--shadow-card)]">
          <Building2 className="mx-auto h-10 w-10 text-[#685F58]/50" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[#685F58]">{t.ownerEmptyHotels}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredHotels.map((hotel) => {
            const operational = isHotelOperational(hotel);
            const expired = isHotelExpired(hotel);
            const isBusy = busyHotelId === hotel.id;

            const statusLabel =
              hotel.status === 'pending'
                ? t.statusPending
                : hotel.status === 'suspended'
                  ? t.statusSuspended
                  : expired
                    ? t.statusExpired
                    : t.statusActive;

            const statusColor =
              hotel.status === 'pending'
                ? 'text-[#8C5338]'
                : operational
                  ? 'text-[#2E6B47]'
                  : 'text-[#9E3B33]';

            return (
              <article
                key={hotel.id}
                className="flex flex-col justify-between rounded-3xl border border-[#2C2C2C]/10 bg-[#FAF7F2] p-5 shadow-[var(--shadow-card)] sm:p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-[#2C2C2C]">
                        {hotel.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#685F58]">
                        <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {t.ownerCreatedAtLabel} {formatDate(hotel.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 border-t border-[#2C2C2C]/10 pt-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1.5 text-[#685F58]">
                        <Phone className="h-3.5 w-3.5 text-[#8C5338]" aria-hidden="true" />
                        <span>{t.hotelPhoneLabel}</span>
                      </dt>
                      <dd className="ltr-field tabular-nums font-semibold text-[#2C2C2C]">
                        {hotel.receptionPhone ? `+${hotel.receptionPhone}` : '—'}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1.5 text-[#685F58]">
                        <Mail className="h-3.5 w-3.5 text-[#8C5338]" aria-hidden="true" />
                        <span>{t.hotelEmailLabel}</span>
                      </dt>
                      <dd className="ltr-field truncate font-semibold text-[#2C2C2C]">
                        {hotel.email || hotel.ownerEmail || '—'}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1.5 text-[#685F58]">
                        <CalendarClock
                          className="h-3.5 w-3.5 text-[#8C5338]"
                          aria-hidden="true"
                        />
                        <span>{t.ownerExpiresAtLabel}</span>
                      </dt>
                      <dd className="tabular-nums font-semibold text-[#2C2C2C]">
                        {formatDate(hotel.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Owner Action Controls: Approve, Renew, Suspend/Reactivate, Delete */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#2C2C2C]/10 pt-4">
                  {hotel.status === 'pending' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(hotel.id, () =>
                          approveOrRenewHotel(hotel.id, durationDays, null)
                        )
                      }
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2C2C2C] px-3.5 py-2 text-xs font-bold text-[#FAF7F2] hover:bg-[#2C2C2C]/90 disabled:opacity-50 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-4 w-4 text-[#E8A588]" aria-hidden="true" />
                      <span>{t.ownerApproveButton}</span>
                    </button>
                  )}

                  {hotel.status !== 'pending' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(hotel.id, () =>
                          approveOrRenewHotel(hotel.id, durationDays, hotel.expiresAt)
                        )
                      }
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2C2C2C] px-3.5 py-2 text-xs font-bold text-[#FAF7F2] hover:bg-[#2C2C2C]/90 disabled:opacity-50 whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-[#E8A588]" aria-hidden="true" />
                      <span>{t.ownerRenewButton}</span>
                    </button>
                  )}

                  {hotel.status === 'approved' && hotel.isActive && !expired && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(hotel.id, () => suspendHotel(hotel.id))
                      }
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#C58B6D]/45 bg-[#E8A588]/20 px-3.5 py-2 text-xs font-semibold text-[#8C5338] hover:bg-[#E8A588]/35 disabled:opacity-50 whitespace-nowrap"
                    >
                      <PauseCircle className="h-4 w-4" aria-hidden="true" />
                      <span>{t.ownerSuspendButton}</span>
                    </button>
                  )}

                  {hotel.status === 'suspended' && !expired && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(hotel.id, () => reactivateHotel(hotel.id))
                      }
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#2E6B47]/35 bg-[#2E6B47]/10 px-3.5 py-2 text-xs font-semibold text-[#2E6B47] hover:bg-[#2E6B47]/20 disabled:opacity-50 whitespace-nowrap"
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      <span>{t.ownerReactivateButton}</span>
                    </button>
                  )}

                  {confirmDeleteId === hotel.id ? (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleAction(hotel.id, async () => {
                            await deleteHotel(hotel.id);
                            setConfirmDeleteId(null);
                          })
                        }
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#9E3B33] px-3.5 py-2 text-xs font-bold text-[#FFFFFF] hover:bg-[#9E3B33]/90 disabled:opacity-50 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.ownerConfirmDelete}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#2C2C2C]/15 bg-[#F4EFEA] px-3 py-2 text-xs font-semibold text-[#2C2C2C] whitespace-nowrap"
                      >
                        {t.ownerCancelDelete}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(hotel.id)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#9E3B33]/25 bg-[#9E3B33]/8 px-3.5 py-2 text-xs font-semibold text-[#9E3B33] hover:bg-[#9E3B33]/15 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.ownerDeleteButton}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
