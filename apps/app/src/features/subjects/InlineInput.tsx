// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { fieldFocusClass } from '../../ui/Field';
import { cx } from '../../ui/cx';

const ghostClass = `h-9 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm text-ink placeholder:italic placeholder:text-ink-muted ${fieldFocusClass}`;

export interface InlineInputProps {
  placeholder?: string;
  label: string;
  value: string;
  readOnly: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
  onCommit: (value: string) => void;
}

export function InlineInput({ label, value, readOnly, required, maxLength, placeholder, className, onCommit }: InlineInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next === value || (required && !next)) return;
    onCommit(next);
  }

  return (
    <input
      aria-label={label}
      className={cx(ghostClass, !readOnly && 'hover:border-line-strong', className)}
      value={draft ?? value}
      readOnly={readOnly}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}
