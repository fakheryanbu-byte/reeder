import { AlertCircle } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TranslationKeys } from '../i18n/ar';
import type { CalendarType } from '../types/guest';
import {
  clampDatePartsToRange,
  convertDateBetweenCalendars,
  formatDateParts,
  getCurrentGregorianDate,
  getCurrentHijriDate,
  getDaysInMonth,
  getYearRange,
  parseDateStringToParts,
  type ActiveCalendar,
  type DateParts,
} from '../utils/dateWheelUtils';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 1;
const SPACER_HEIGHT = 0; // Single visible highlighted row only

export interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

interface WheelColumnProps<T extends string | number> {
  ariaLabel: string;
  options: WheelOption<T>[];
  value: T;
  onSelect: (val: T) => void;
}

function WheelColumn<T extends string | number>({
  ariaLabel,
  options,
  value,
  onSelect,
}: WheelColumnProps<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [visualCenterFloat, setVisualCenterFloat] = useState(() =>
    Math.max(
      0,
      options.findIndex((opt) => opt.value === value)
    )
  );

  const isProgrammaticRef = useRef(false);
  const suppressClickRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const momentumRafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startScrollTop: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    moved: boolean;
  } | null>(null);

  const cancelMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      window.cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // Sync scroll position whenever external value or options change
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (dragStateRef.current?.active) return;

    const rawIdx = options.findIndex((opt) => opt.value === value);
    const targetIdx = Math.max(0, rawIdx);
    const targetTop = targetIdx * ITEM_HEIGHT;
    setVisualCenterFloat(targetIdx);

    if (Math.abs(el.scrollTop - targetTop) > 1.5) {
      isProgrammaticRef.current = true;
      el.scrollTop = targetTop;
      const timer = window.setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [options, value]);

  useEffect(() => {
    return () => {
      cancelMomentum();
      clearSettleTimer();
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [cancelMomentum, clearSettleTimer]);

  const commitNearestIndex = useCallback(
    (scrollTop: number, snapDom: boolean, onlyIfChanged = false) => {
      const el = scrollerRef.current;
      const list = optionsRef.current;
      if (!el || list.length === 0) return;

      const idx = Math.max(0, Math.min(list.length - 1, Math.round(scrollTop / ITEM_HEIGHT)));
      const nextOpt = list[idx];

      if (snapDom && Math.abs(el.scrollTop - idx * ITEM_HEIGHT) > 1) {
        isProgrammaticRef.current = true;
        el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
        window.setTimeout(() => {
          isProgrammaticRef.current = false;
        }, 180);
      }

      if (nextOpt !== undefined && (!onlyIfChanged || nextOpt.value !== latestValueRef.current)) {
        onSelect(nextOpt.value);
      }
    },
    [onSelect]
  );

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;

    const currentTop = el.scrollTop;
    if (scrollRafRef.current === null) {
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (scrollerRef.current) {
          setVisualCenterFloat(scrollerRef.current.scrollTop / ITEM_HEIGHT);
        }
      });
    }

    if (isProgrammaticRef.current || dragStateRef.current?.active) {
      return;
    }

    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(() => {
      if (!scrollerRef.current || dragStateRef.current?.active) return;
      commitNearestIndex(scrollerRef.current.scrollTop, false, true);
    }, 85);

    setVisualCenterFloat(currentTop / ITEM_HEIGHT);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;

    cancelMomentum();
    clearSettleTimer();
    isProgrammaticRef.current = false;
    suppressClickRef.current = false;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: el.scrollTop,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocity: 0,
      moved: false,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const el = scrollerRef.current;
    if (!drag || !drag.active || !el) return;

    const totalDy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(totalDy) > 4) {
      drag.moved = true;
      suppressClickRef.current = true;
      setIsMouseDragging(true);
      try {
        el.setPointerCapture(drag.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
    }

    if (!drag.moved) return;

    const now = performance.now();
    const dt = Math.max(4, now - drag.lastTime);
    const stepDy = drag.lastY - e.clientY;
    drag.velocity = drag.velocity * 0.4 + (stepDy / dt) * 0.6;
    drag.lastY = e.clientY;
    drag.lastTime = now;

    const maxScroll = Math.max(0, (optionsRef.current.length - 1) * ITEM_HEIGHT);
    const nextScrollTop = Math.max(0, Math.min(maxScroll, drag.startScrollTop - totalDy));
    el.scrollTop = nextScrollTop;
    setVisualCenterFloat(nextScrollTop / ITEM_HEIGHT);
  };

  const finishMouseDrag = () => {
    const drag = dragStateRef.current;
    const el = scrollerRef.current;
    if (!drag || !el) return;

    dragStateRef.current = null;
    try {
      if (el.hasPointerCapture(drag.pointerId)) {
        el.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // Ignore
    }

    if (!drag.moved) {
      setIsMouseDragging(false);
      return;
    }

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 60);

    const initialVelocity = drag.velocity;
    if (Math.abs(initialVelocity) > 0.14) {
      let velocityPxPerFrame = initialVelocity * 16;
      const maxScroll = Math.max(0, (optionsRef.current.length - 1) * ITEM_HEIGHT);

      const step = () => {
        if (!scrollerRef.current) return;
        scrollerRef.current.scrollTop = Math.max(
          0,
          Math.min(maxScroll, scrollerRef.current.scrollTop + velocityPxPerFrame)
        );
        setVisualCenterFloat(scrollerRef.current.scrollTop / ITEM_HEIGHT);
        velocityPxPerFrame *= 0.91;

        if (
          Math.abs(velocityPxPerFrame) > 0.6 &&
          scrollerRef.current.scrollTop > 0 &&
          scrollerRef.current.scrollTop < maxScroll
        ) {
          momentumRafRef.current = window.requestAnimationFrame(step);
        } else {
          momentumRafRef.current = null;
          setIsMouseDragging(false);
          commitNearestIndex(scrollerRef.current.scrollTop, true);
        }
      };

      momentumRafRef.current = window.requestAnimationFrame(step);
    } else {
      setIsMouseDragging(false);
      commitNearestIndex(el.scrollTop, true);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const idx = Math.max(
      0,
      options.findIndex((opt) => opt.value === value)
    );
    let nextIdx = idx;
    if (e.key === 'ArrowDown') nextIdx = Math.min(options.length - 1, idx + 1);
    else if (e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
    else if (e.key === 'PageDown') nextIdx = Math.min(options.length - 1, idx + 5);
    else if (e.key === 'PageUp') nextIdx = Math.max(0, idx - 5);
    else return;

    e.preventDefault();
    onSelect(options[nextIdx].value);
  };

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishMouseDrag}
      onPointerCancel={finishMouseDrag}
      onKeyDown={handleKeyDown}
      style={{
        height: `${ITEM_HEIGHT * VISIBLE_ROWS}px`,
        scrollSnapType: isMouseDragging ? 'none' : 'y mandatory',
        overscrollBehavior: 'contain',
      }}
      className={`wheel-scrollbar-hidden relative w-full select-none overflow-y-auto rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B6D] ${
        isMouseDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {SPACER_HEIGHT > 0 && <div style={{ height: `${SPACER_HEIGHT}px` }} aria-hidden="true" />}
      {options.map((opt, idx) => {
        const dist = Math.abs(idx - visualCenterFloat);
        const opacity = Math.max(0.35, 1 - dist * 0.45);
        const scale = Math.max(0.88, 1 - dist * 0.1);
        const isSelected = idx === Math.round(visualCenterFloat);

        return (
          <div
            key={String(opt.value)}
            role="option"
            aria-selected={opt.value === value}
            onClick={() => {
              if (scrollerRef.current && !isMouseDragging && !suppressClickRef.current) {
                if (VISIBLE_ROWS === 1 && options.length === 2) {
                  const nextIdx = idx === 0 ? 1 : 0;
                  const nextOpt = options[nextIdx];
                  isProgrammaticRef.current = true;
                  scrollerRef.current.scrollTo({
                    top: nextIdx * ITEM_HEIGHT,
                    behavior: 'smooth',
                  });
                  onSelect(nextOpt.value);
                  window.setTimeout(() => {
                    isProgrammaticRef.current = false;
                  }, 220);
                  return;
                }

                isProgrammaticRef.current = true;
                scrollerRef.current.scrollTo({
                  top: idx * ITEM_HEIGHT,
                  behavior: 'smooth',
                });
                onSelect(opt.value);
                window.setTimeout(() => {
                  isProgrammaticRef.current = false;
                }, 220);
              }
            }}
            style={{
              height: `${ITEM_HEIGHT}px`,
              scrollSnapAlign: 'start',
              opacity,
              transform: `scale(${scale})`,
            }}
            className={`flex items-center justify-center tabular-nums transition-colors duration-100 ${
              isSelected
                ? 'text-sm font-bold text-[#2C2C2C]'
                : 'text-xs font-medium text-[#685F58]'
            }`}
          >
            {opt.label}
          </div>
        );
      })}
      {SPACER_HEIGHT > 0 && <div style={{ height: `${SPACER_HEIGHT}px` }} aria-hidden="true" />}
    </div>
  );
}

export interface DateWheelPickerProps {
  value: string;
  calendar: CalendarType;
  defaultCalendar?: ActiveCalendar;
  dobMissing?: boolean;
  calendarMissing?: boolean;
  dobLabel: string;
  calendarLabel: string;
  requiredMark: string;
  missingBadge: string;
  onChange: (formattedDate: string, calendar: ActiveCalendar) => void;
  t: TranslationKeys;
}

export function DateWheelPicker({
  value,
  calendar,
  defaultCalendar = 'hijri',
  dobMissing = false,
  calendarMissing = false,
  dobLabel,
  calendarLabel,
  requiredMark,
  missingBadge,
  onChange,
  t,
}: DateWheelPickerProps) {
  const initialState = useMemo(() => {
    const parsed = parseDateStringToParts(value, calendar);
    const activeCal: ActiveCalendar = parsed
      ? parsed.calendar
      : calendar === 'hijri' || calendar === 'gregorian'
        ? calendar
        : defaultCalendar;

    if (parsed) {
      return {
        calendar: activeCal,
        parts: clampDatePartsToRange(parsed.parts, activeCal),
      };
    }

    const fallbackParts =
      activeCal === 'hijri' ? getCurrentHijriDate() : getCurrentGregorianDate();
    return {
      calendar: activeCal,
      parts: clampDatePartsToRange(
        {
          year: fallbackParts.year - 30,
          month: fallbackParts.month,
          day: fallbackParts.day,
        },
        activeCal
      ),
    };
  }, [value, calendar, defaultCalendar]);

  const [activeCal, setActiveCal] = useState<ActiveCalendar>(initialState.calendar);
  const [selectedParts, setSelectedParts] = useState<DateParts>(initialState.parts);

  useEffect(() => {
    const parsed = parseDateStringToParts(value, calendar);
    if (parsed) {
      const clamped = clampDatePartsToRange(parsed.parts, parsed.calendar);
      setActiveCal(parsed.calendar);
      setSelectedParts(clamped);
    } else if (calendar === 'hijri' || calendar === 'gregorian') {
      setActiveCal(calendar);
      setSelectedParts((prev) => clampDatePartsToRange(prev, calendar));
    }
  }, [value, calendar]);

  const currentCalYear = useMemo(
    () =>
      activeCal === 'hijri' ? getCurrentHijriDate().year : getCurrentGregorianDate().year,
    [activeCal]
  );

  const dayOptions = useMemo<WheelOption<number>[]>(() => {
    const maxDays = getDaysInMonth(activeCal, selectedParts.year, selectedParts.month);
    return Array.from({ length: maxDays }, (_, i) => ({
      value: i + 1,
      label: String(i + 1).padStart(2, '0'),
    }));
  }, [activeCal, selectedParts.year, selectedParts.month]);

  const monthOptions = useMemo<WheelOption<number>[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1).padStart(2, '0'),
      })),
    []
  );

  const yearOptions = useMemo<WheelOption<number>[]>(
    () =>
      getYearRange(currentCalYear).map((y) => ({
        value: y,
        label: String(y),
      })),
    [currentCalYear]
  );

  const calendarOptions = useMemo<WheelOption<ActiveCalendar>[]>(
    () => [
      { value: 'hijri', label: t.calendarHijri },
      { value: 'gregorian', label: t.calendarGregorian },
    ],
    [t.calendarHijri, t.calendarGregorian]
  );

  const commitDate = (nextParts: DateParts, nextCal: ActiveCalendar) => {
    const clamped = clampDatePartsToRange(nextParts, nextCal);
    setSelectedParts(clamped);
    onChange(formatDateParts(clamped, nextCal), nextCal);
  };

  const handleSelectCalendar = (targetCal: ActiveCalendar) => {
    const converted =
      targetCal === activeCal
        ? selectedParts
        : convertDateBetweenCalendars(selectedParts, activeCal, targetCal);
    const clamped = clampDatePartsToRange(converted, targetCal);
    setActiveCal(targetCal);
    setSelectedParts(clamped);
    onChange(formatDateParts(clamped, targetCal), targetCal);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
      {/* Right box (RTL): 3-Column Scrollable DOB Wheel directly inside the Date of Birth box */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#685F58]">
            {dobLabel}
            <span className="ms-1 text-[#8C5338]">{requiredMark}</span>
          </span>
          {dobMissing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8C5338]">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              <span>{missingBadge}</span>
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF]">
          <div
            dir="ltr"
            className="grid grid-cols-3 border-b border-[#2C2C2C]/8 bg-[#F4EFEA]/65 py-1 text-center text-[10px] font-semibold text-[#685F58]"
          >
            <span>{t.wheelDay}</span>
            <span>{t.wheelMonth}</span>
            <span>{t.wheelYear}</span>
          </div>

          <div
            style={{ height: `${ITEM_HEIGHT * VISIBLE_ROWS}px` }}
            className="relative overflow-hidden bg-[#FFFFFF] px-1"
          >
            <div dir="ltr" className="relative z-20 grid grid-cols-3 gap-0.5">
              <WheelColumn
                ariaLabel={t.wheelDay}
                options={dayOptions}
                value={selectedParts.day}
                onSelect={(day) => commitDate({ ...selectedParts, day }, activeCal)}
              />
              <WheelColumn
                ariaLabel={t.wheelMonth}
                options={monthOptions}
                value={selectedParts.month}
                onSelect={(month) => commitDate({ ...selectedParts, month }, activeCal)}
              />
              <WheelColumn
                ariaLabel={t.wheelYear}
                options={yearOptions}
                value={selectedParts.year}
                onSelect={(year) => commitDate({ ...selectedParts, year }, activeCal)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Left box (RTL): Compact wheel strictly for Hijri / Gregorian */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-[#685F58]">
            {calendarLabel}
            <span className="ms-0.5 text-[#8C5338]">{requiredMark}</span>
          </span>
          {calendarMissing && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#8C5338]">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              <span>{missingBadge}</span>
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-[#2C2C2C]/15 bg-[#FFFFFF]">
          <div className="border-b border-[#2C2C2C]/8 bg-[#F4EFEA]/65 py-1 text-center text-[10px] font-semibold text-[#685F58]">
            {t.calendarHijri} / {t.calendarGregorian}
          </div>

          <div
            style={{ height: `${ITEM_HEIGHT * VISIBLE_ROWS}px` }}
            className="relative overflow-hidden bg-[#FFFFFF] px-1"
          >
            <div className="relative z-20">
              <WheelColumn
                ariaLabel={calendarLabel}
                options={calendarOptions}
                value={activeCal}
                onSelect={(cal) => handleSelectCalendar(cal)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
