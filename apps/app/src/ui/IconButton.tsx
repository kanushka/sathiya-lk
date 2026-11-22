// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  label: string;
  variant?: 'ghost' | 'secondary' | 'onBrand' | 'danger';
  size?: 'sm' | 'md';
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', pressed, className, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx('shrink-0 px-0', size === 'sm' ? 'w-8' : 'w-10', className)}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </Button>
  );
});
