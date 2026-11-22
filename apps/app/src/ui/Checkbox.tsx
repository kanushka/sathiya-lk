// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CheckboxBox } from './CheckboxBox';
import { cx } from './cx';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  indeterminate,
  disabled,
  id,
  name,
  'aria-invalid': ariaInvalid,
  className,
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label
      htmlFor={inputId}
      className={cx('inline-flex items-start gap-2.5', disabled ? 'cursor-not-allowed' : 'cursor-pointer', className)}
    >
      <span className="relative flex shrink-0">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-labelledby={`${inputId}-label`}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className={cx('peer absolute inset-0 m-0 h-full w-full opacity-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        />
        <CheckboxBox checked={checked} indeterminate={indeterminate} disabled={disabled} invalid={ariaInvalid} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span id={`${inputId}-label`} className={cx('text-sm leading-[18px]', disabled ? 'text-ink-muted' : 'text-ink')}>{label}</span>
        {hint && (
          <span id={`${inputId}-hint`} className="text-xs text-ink-muted">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
