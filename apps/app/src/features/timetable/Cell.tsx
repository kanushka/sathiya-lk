// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export interface CellView {
  title: string;
  sub: string;
  color: string;
  isGroup: boolean;
  dashed?: boolean;
}

export function CellBody({ cells, readOnly }: { cells: CellView[]; readOnly?: boolean }) {
  if (cells.length === 0) {
    return readOnly ? null : (
      <span aria-hidden="true" className="text-center text-xl font-semibold leading-none">
        +
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-1">
      {cells.map((c, i) => (
        <span
          key={i}
          className="flex flex-col gap-0.5 rounded-md px-1.5 py-1"
          style={{ background: c.color, border: c.dashed ? '1.5px dashed rgba(20,33,61,.45)' : undefined }}
          data-group={c.isGroup || undefined}
        >
          <span className="text-[13px] font-bold">{c.title}</span>
          <span className="text-[11px] opacity-80">{c.sub}</span>
        </span>
      ))}
    </span>
  );
}
