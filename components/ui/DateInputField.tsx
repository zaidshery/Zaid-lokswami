'use client';

import { useEffect, useState } from 'react';
import { formatUiDateInputValue, parseUiDateInput } from '@/lib/utils/dateFormat';

type DateInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
};

export default function DateInputField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'dd/mm/yy',
  className = '',
  required = false,
  disabled = false,
}: DateInputFieldProps) {
  const [displayValue, setDisplayValue] = useState(formatUiDateInputValue(value));

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

  return (
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
      className={className}
      required={required}
      disabled={disabled}
    />
  );
}
