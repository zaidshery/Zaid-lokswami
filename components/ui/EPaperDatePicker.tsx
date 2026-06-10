'use client';

import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

type EPaperDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  clearLabel?: string;
  onClear?: () => void;
};

const HINDI_WEEKDAYS = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const HINDI_MONTHS = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];
const ENGLISH_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatHindiDate(dateStr: string, placeholder = 'तारीख चुनें'): string {
  if (!dateStr) return placeholder;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const dateObj = new Date(year, month - 1, day);
  if (isNaN(dateObj.getTime())) return dateStr;

  const weekdayName = HINDI_WEEKDAYS[dateObj.getDay()];
  const monthName = HINDI_MONTHS[month - 1];
  const dayStr = String(day).padStart(2, '0');

  return `${weekdayName}, ${dayStr} ${monthName} ${year}`;
}

function getCalendarDays(anchorDate: Date = new Date()) {
  // Find the Saturday of the current week
  const currentDayOfWeek = anchorDate.getDay();
  const daysToSaturday = 6 - currentDayOfWeek;
  const saturday = new Date(anchorDate);
  saturday.setDate(anchorDate.getDate() + daysToSaturday);

  // Grid starts 34 days before that Saturday (total 35 days / 5 rows)
  const days: Date[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() - i);
    days.push(d);
  }
  return days;
}

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function EPaperDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'तारीख चुनें',
  onClear,
}: EPaperDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setTempValue(value);
  }, [value, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectDay = (dateStr: string) => {
    if (tempValue === dateStr) {
      setTempValue('');
    } else {
      setTempValue(dateStr);
    }
  };

  const handleCommit = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const calendarDays = getCalendarDays(new Date());
  const todayStr = toLocalDateString(new Date());

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl text-zinc-900 transition-all border border-gray-100 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="EPaper date picker"
      >
        {/* Red Circle Close Button at Top-Right Edge */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer z-50"
          aria-label="Close calendar"
        >
          <X className="h-4 w-4 stroke-[2.5]" />
        </button>

        {/* Modal Title */}
        <h3 className="mb-4 text-center text-lg font-black tracking-wide text-zinc-900 dark:text-zinc-100">
          ePaper डेट चुनें
        </h3>

        {/* Weekdays Row */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-zinc-500 mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 dark:text-zinc-400">
          {HINDI_WEEKDAYS.map((day, idx) => (
            <div key={`weekday-${idx}`} className="truncate px-0.5">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-x-1 gap-y-3.5 mb-6 text-center">
          {calendarDays.map((date, idx) => {
            const dateStr = toLocalDateString(date);
            const isSelected = tempValue === dateStr;
            const isFuture = dateStr > todayStr;
            const dayNum = date.getDate();
            const monthShort = ENGLISH_MONTHS_SHORT[date.getMonth()];

            return (
              <button
                key={`cal-day-${idx}`}
                type="button"
                disabled={isFuture}
                onClick={() => handleSelectDay(dateStr)}
                className={`mx-auto flex h-12 w-12 flex-col items-center justify-center rounded-full transition focus:outline-none ${
                  isSelected
                    ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/30'
                    : isFuture
                      ? 'text-zinc-200 pointer-events-none hover:bg-transparent dark:text-zinc-800'
                      : 'hover:bg-zinc-100 text-zinc-800 font-semibold cursor-pointer dark:hover:bg-zinc-800 dark:text-zinc-200'
                }`}
              >
                <span className="text-sm leading-none">{dayNum}</span>
                <span
                  className={`text-[9px] mt-0.5 font-bold leading-none ${
                    isSelected
                      ? 'text-white/80'
                      : isFuture
                        ? 'text-zinc-200/60 dark:text-zinc-800/60'
                        : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {monthShort}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cancel & Choose Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 border border-zinc-200 rounded-xl py-2.5 text-sm font-bold text-zinc-700 bg-white hover:bg-zinc-50 transition text-center cursor-pointer dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            रद्द करें
          </button>
          <button
            type="button"
            onClick={handleCommit}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-bold transition text-center cursor-pointer shadow-md shadow-red-600/25"
          >
            चुनें
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative w-full">
      {/* Date Pill Button */}
      <div className="flex w-full items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`reader-focus-ring flex h-12 w-full items-center justify-between gap-2.5 rounded-full border border-gray-300 bg-white px-4 text-[13px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:bg-zinc-800/80 sm:h-11 sm:text-sm ${className}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="truncate">{formatHindiDate(value, placeholder)}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        </button>

        {value && onClear ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Clear date"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-zinc-500 transition hover:bg-gray-50 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:h-11 sm:w-11"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Render via Portal to Body */}
      {mounted && typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
    </div>
  );
}
