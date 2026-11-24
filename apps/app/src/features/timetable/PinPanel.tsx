// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { cx } from '../../ui/cx';
import { PinBar } from './PinBar';
import { PinLegend } from './pinOverlay';
import type { PinMode } from './usePinMode';

export function PinHeader({ pin, hint, readOnly }: { pin: PinMode; hint: string; readOnly: boolean }) {
  if (pin.target && pin.progress) {
    return (
      <PinBar
        title={pin.names?.title ?? ''}
        {...(pin.names?.detail ? { detail: pin.names.detail } : {})}
        color={pin.names?.color ?? '#E9E9E9'}
        progress={pin.progress}
        fullNote={pin.fullNote}
        suggestedCount={pin.suggested.length}
        onSuggest={pin.suggest}
        onPinSuggested={() => void pin.pinSuggested()}
        onDone={pin.stop}
      />
    );
  }
  return readOnly ? null : <p className="mb-3.5 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[13px] text-ink-soft">{hint}</p>;
}

export interface PinSectionProps {
  pin: PinMode;
  teacher: string;
  teacherRows?: boolean;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function PinSection({ pin, teacher, teacherRows, className, children, footer }: PinSectionProps) {
  const target = pin.target;
  const classes = pin.names?.classes ?? '';
  return (
    <section
      data-pin-mode={target ? 'true' : undefined}
      className={cx('min-w-0 overflow-x-auto rounded-[14px] border border-line bg-white p-2 md:p-4', className, target && 'outline outline-2 outline-offset-2 outline-brand')}
    >
      {target && (
        <PinLegend
          teacher={teacher}
          {...(teacherRows ? { teacherRows: { classes, base: pin.names?.base ?? '' } } : {})}
          {...(target.groupKey === undefined ? {} : { group: { count: new Set(target.lessons.map((l) => l.teacherId)).size, classes } })}
        />
      )}
      {children}
      <p role="status" className="mx-1 mb-0 mt-3 min-h-[1px] text-[13px] font-semibold text-success empty:mt-0">
        {pin.message}
      </p>
      {footer}
    </section>
  );
}

export function PinSpacer({ active }: { active: boolean }) {
  return active ? <div aria-hidden="true" className="h-36 md:hidden" /> : null;
}
