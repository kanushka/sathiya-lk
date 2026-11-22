// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useId, type ReactNode } from 'react';
import { cx } from './cx';

export interface RadioOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string = string> {
  name: string;
  label?: ReactNode;
  options: RadioOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  'aria-invalid'?: boolean;
  className?: string;
}

export function RadioGroup<V extends string = string>({
  name,
  label,
  options,
  value,
  onChange,
  'aria-invalid': ariaInvalid,
  className,
}: RadioGroupProps<V>) {
  const baseId = useId();
  return (
    <fieldset className={cx('m-0 min-w-0 border-0 p-0', className)}>
      {label && <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ink-soft">{label}</legend>}
      <div className="flex flex-col gap-2">
        {options.map((o, i) => {
          const id = `${baseId}-${i}`;
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cx('inline-flex items-center gap-2.5', o.disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
            >
              <span className="relative flex shrink-0">
                <input
                  id={id}
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={checked}
                  disabled={o.disabled}
                  aria-invalid={ariaInvalid}
                  onChange={() => onChange(o.value)}
                  className={cx('peer absolute inset-0 m-0 h-full w-full opacity-0', o.disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-[18px] w-[18px] shrink-0 rounded-full transition-all',
                    'peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand/30',
                    o.disabled
                      ? checked
                        ? 'border-[5.5px] border-line bg-surface-2'
                        : 'border-[1.5px] border-line bg-surface-2'
                      : checked
                        ? 'border-[5.5px] border-brand bg-white'
                        : ariaInvalid
                          ? 'border-[1.5px] border-danger bg-white'
                          : 'border-[1.5px] border-line-hover bg-white',
                  )}
                />
              </span>
              <span className={cx('text-sm', o.disabled ? 'text-ink-muted' : 'text-ink')}>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
