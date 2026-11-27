// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useId, type ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';
import { Spinner, focusRingClass } from './Button';
import { cx } from './cx';

export interface ListSectionProps {
  title: string;
  count?: number;
  tone?: BadgeTone;
  /** Render children as they are (cards, a single row) instead of inside the list frame. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

/** One group of a phone list: a small heading with a count badge, then its rows. */
export function ListSection({ title, count, tone = 'neutral', bare = false, className, children }: ListSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cx('mb-5', className)}>
      <h2 id={headingId} className="m-0 mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted">
        {title}
        {count !== undefined && (
          <Badge tone={tone} className="h-5 px-2 text-[11px] tracking-normal">
            {count}
          </Badge>
        )}
      </h2>
      {bare ? (
        children
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-white p-0">{children}</ul>
      )}
    </section>
  );
}

export interface ListRowAction {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  tone?: 'brand' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  describedBy?: string;
}

export interface ListRowProps {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  /** Tapping the row body runs this, for example to open the edit dialog. */
  onOpen?: () => void;
  openLabel?: string;
  /** Plain trailing text, such as a count. */
  meta?: ReactNode;
  action?: ListRowAction;
  className?: string;
}

const actionTone = {
  brand: 'text-brand hover:bg-brand/10',
  danger: 'text-danger hover:bg-danger-soft',
};

export function ListRow({ lead, title, detail, onOpen, openLabel, meta, action, className }: ListRowProps) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-[13px] text-ink-muted">{detail}</span>}
      </span>
      {meta && <span className="shrink-0 whitespace-nowrap text-[13px] text-ink-soft">{meta}</span>}
    </>
  );
  const bodyClass = 'flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left';
  return (
    <li className={cx('flex items-center border-b border-line-soft last:border-b-0', className)}>
      {onOpen ? (
        <button
          type="button"
          aria-label={openLabel}
          onClick={onOpen}
          className={cx(bodyClass, action ? 'pr-1' : 'pr-4', 'hover:bg-surface', focusRingClass, 'focus-visible:ring-offset-0 focus-visible:ring-inset')}
        >
          {body}
        </button>
      ) : (
        <div className={cx(bodyClass, action ? 'pr-1' : 'pr-4')}>{body}</div>
      )}
      {action && (
        <button
          type="button"
          aria-label={action.ariaLabel}
          aria-describedby={action.describedBy}
          aria-busy={action.loading || undefined}
          disabled={action.disabled || action.loading}
          onClick={action.onClick}
          className={cx(
            'mr-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
            focusRingClass,
            'disabled:cursor-not-allowed disabled:opacity-[.45]',
            actionTone[action.tone ?? 'brand'],
          )}
        >
          {action.loading && <Spinner />}
          {action.label}
        </button>
      )}
    </li>
  );
}

export function initialsOf(name: string): string {
  const words = name
    .replace(/\b(Mr|Mrs|Ms|Miss|Dr|Rev|Fr|Ven|Prof)\b\.?/gi, ' ')
    .split(/[\s.]+/)
    .filter(Boolean);
  const picked = words.length > 1 ? [words[0] ?? '', words[words.length - 1] ?? ''] : words;
  return picked.map((w) => Array.from(w)[0]?.toUpperCase() ?? '').join('');
}

/** Round initials for a person row. */
export function ListInitials({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[13px] font-bold text-brand"
    >
      {initialsOf(name)}
    </span>
  );
}

/** A rounded tile with a short label on a colour, for example a subject. */
export function ListTile({ label, color }: { label: string; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={color ? { background: color } : undefined}
      className={cx(
        'inline-flex h-10 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 px-0.5 text-center text-[11px] leading-[1.1] font-bold text-ink [overflow-wrap:anywhere]',
        !color && 'bg-surface-3',
      )}
    >
      {label}
    </span>
  );
}
