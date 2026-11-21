// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-brand text-on-brand hover:brightness-110',
  secondary: 'border border-line-strong bg-white text-ink hover:bg-slate-50',
  danger: 'border border-[#E8C3C3] bg-white text-[#A3262A] hover:bg-[#FBEFEF]',
  ghost: 'border border-transparent bg-transparent text-ink-soft hover:bg-slate-100',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-11 px-5 text-[15px] rounded-[10px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
