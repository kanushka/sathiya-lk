// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useLayoutEffect, useRef, type HTMLAttributes, type TableHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cx } from './cx';

function labelCells(root: HTMLElement): void {
  const labels = Array.from(root.querySelectorAll('thead tr:first-child th')).map((th) => th.textContent?.trim() ?? '');
  for (const row of Array.from(root.querySelectorAll('tbody tr'))) {
    const cells = Array.from(row.children);
    if (cells.some((c) => (c as HTMLTableCellElement).colSpan > 1)) continue;
    cells.forEach((cell, i) => {
      const label = labels[i];
      if (label) cell.setAttribute('data-label', label);
      else cell.removeAttribute('data-label');
    });
  }
}

export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) labelCells(ref.current);
  });
  return (
    <div ref={ref} className="phone-cards overflow-x-auto rounded-[14px] border border-line bg-white">
      <table className={cx('w-full border-collapse text-left', className)} {...rest} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('hover:bg-surface', className)} {...rest} />;
}

export function Th({ className, scope = 'col', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cx(
        'border-b border-line bg-surface px-3 py-2.5 text-xs font-bold uppercase tracking-[.04em] text-ink-muted',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('border-b border-line-soft px-3 py-3 align-top text-sm text-ink', className)} {...rest} />;
}
