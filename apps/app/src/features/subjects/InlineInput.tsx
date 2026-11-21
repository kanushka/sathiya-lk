// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { inputClass } from '../../ui/Field';
import { cx } from '../../ui/cx';

export interface InlineInputProps {
  label: string;
  value: string;
  readOnly: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
  onCommit: (value: string) => void;
}

export function InlineInput({ label, value, readOnly, required, maxLength, className, onCommit }: InlineInputProps) {
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
      className={cx(inputClass, 'h-9 border-transparent bg-transparent', !readOnly && 'hover:border-line-strong', className)}
      value={draft ?? value}
      readOnly={readOnly}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}
