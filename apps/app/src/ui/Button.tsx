// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';

export const focusRingClass =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSolid' | 'ghost' | 'onBrand' | 'subtle' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  square?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
}

const SLOW_MS = 5000;

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      data-spinner
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className={cx('shrink-0 motion-safe:animate-spin motion-reduce:hidden', className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function useSlow(loading: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, [loading]);
  return slow;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-brand text-on-brand hover:brightness-110',
  secondary: 'border border-line-strong bg-white text-ink hover:bg-surface-2',
  danger: 'border border-danger-line bg-white text-danger hover:bg-danger-soft',
  dangerSolid: 'border border-transparent bg-danger text-white hover:bg-danger/90',
  ghost: 'border border-transparent bg-transparent text-ink-soft hover:bg-surface-3',
  onBrand: 'border border-on-brand/40 bg-on-brand/10 text-on-brand hover:bg-on-brand/20',
  subtle: 'border border-transparent bg-surface-3 text-ink-soft hover:bg-line',
  link: 'rounded-sm border-0 bg-transparent p-0 text-brand hover:underline',
};

const squareSizes: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 text-[13px] rounded-lg',
  md: 'h-10 w-10 text-sm rounded-lg',
  lg: 'h-11 w-11 text-[15px] rounded-lg',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-11 px-5 text-[15px] rounded-lg',
};

export function buttonClass({
  variant = 'secondary',
  size = 'md',
  square = false,
}: { variant?: ButtonVariant; size?: ButtonSize; square?: boolean } = {}): string {
  return cx(
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
    focusRingClass,
    'disabled:cursor-not-allowed disabled:opacity-[.45]',
    variants[variant],
    variant === 'link' ? 'text-sm' : (square ? squareSizes : sizes)[size],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', square = false, className, type = 'button', loading = false, loadingLabel, disabled, children, ...rest },
  ref,
) {
  const { t } = useTranslation('common');
  const slow = useSlow(loading);
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClass({ variant, size, square }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="grid">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
            {children}
          </span>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2">
            <Spinner />
            {slow ? t('busy.stillWorking') : (loadingLabel ?? children)}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});
