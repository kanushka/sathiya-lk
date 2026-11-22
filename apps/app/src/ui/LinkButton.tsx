// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { Link, type LinkProps } from 'react-router-dom';
import { buttonClass, type ButtonSize, type ButtonVariant } from './Button';
import { cx } from './cx';

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({ variant = 'secondary', size = 'md', className, ...rest }: LinkButtonProps) {
  return <Link className={cx(buttonClass({ variant, size }), 'no-underline', className)} {...rest} />;
}
