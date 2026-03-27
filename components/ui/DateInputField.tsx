'use client';

import { CalendarDays, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatUiDateInputValue, parseUiDateInput } from '@/lib/utils/dateFormat';

type DateInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  clearLabel?: string;
  onClear?: () => void;
};

export default function DateInputField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'dd/mm/yy',
  className = '',
  required = false,
  disabled = false,
  clearLabel = 'Clear',
  onClear,
}: DateInputFieldProps) {
  const [displayValue, setDisplayValue] = useState(formatUiDateInputValue(value));
  const nativePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayValue(formatUiDateInputValue(value));
  }, [value]);

  const commitValue = () => {
    const parsed = parseUiDateInput(displayValue);
    if (parsed === null) {
      setDisplayValue(formatUiDateInputValue(value));
      return;
    }

    onChange(parsed);
    setDisplayValue(formatUiDateInputValue(parsed));
  };

  const openNativePicker = () => {
    if (disabled) return;

    const picker = nativePickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }

    picker.focus();
    picker.click();
  };

  const handleNativePickerChange = (nextValue: string) => {
    onChange(nextValue);
    setDisplayValue(formatUiDateInputValue(nextValue));
  };

  const hasClearButton = Boolean(onClear && value);
  const inputPaddingClassName = hasClearButton ? 'pr-20' : 'pr-11';

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(event) => setDisplayValue(event.target.value)}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitValue();
          }
        }}
        aria-label={ariaLabel}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        className={`${className} ${inputPaddingClassName}`.trim()}
        required={required}
        disabled={disabled}
      />
      <input
        ref={nativePickerRef}
        type="date"
        value={value}
        onChange={(event) => handleNativePickerChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        disabled={disabled}
      />
      {hasClearButton ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute inset-y-0 right-10 inline-flex w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={openNativePicker}
        aria-label={ariaLabel || 'Choose date'}
        className="absolute inset-y-0 right-1 inline-flex w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        disabled={disabled}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
    </div>
  );
}
