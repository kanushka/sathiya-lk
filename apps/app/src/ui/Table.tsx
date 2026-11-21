// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from './cx';

export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
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
  return <tr className={cx('hover:bg-[#FAFAFB]', className)} {...rest} />;
}

export function Th({ className, scope = 'col', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cx(
        'border-b border-line bg-[#FAFAFB] px-3 py-2.5 text-xs font-bold uppercase tracking-[.04em] text-ink-muted',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('border-b border-[#F0F1F4] px-3 py-3 align-top text-sm text-ink', className)} {...rest} />;
}
