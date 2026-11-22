// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { cx } from './cx';
import { Icon } from './Icon';

export interface CheckboxBoxProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

export function CheckboxBox({ checked, indeterminate, disabled, invalid }: CheckboxBoxProps) {
  const on = checked || indeterminate;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors',
        'peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand/30',
        disabled
          ? on
            ? 'border-line bg-line text-ink-muted'
            : 'border-line bg-surface-2'
          : on
            ? 'border-brand bg-brand text-on-brand'
            : invalid
              ? 'border-danger bg-white'
              : 'border-line-hover bg-white',
      )}
    >
      {indeterminate ? (
        <Icon name="minus" size={12} strokeWidth={3} />
      ) : (
        checked && <Icon name="check" size={12} strokeWidth={3} />
      )}
    </span>
  );
}
