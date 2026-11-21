// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cx } from './cx';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  required?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

export const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-[#7A8194] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 aria-[invalid=true]:border-danger';

export function Field({ label, hint, error, id, required, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? children.props.id ?? autoId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const showHint = !!hint && !error;
  const describedBy = [showHint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={controlId}
        data-required={required || undefined}
        className="text-[13px] font-semibold text-ink-soft data-[required]:after:ml-0.5 data-[required]:after:text-danger data-[required]:after:content-['*']"
      >
        {label}
      </label>
      {control}
      {showHint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
