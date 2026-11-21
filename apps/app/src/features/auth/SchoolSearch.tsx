// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { useEffect, useId, useRef, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { inputClass } from '../../ui/Field';
import { cx } from '../../ui/cx';
import { searchSchools, type DirectorySchool } from './api';

export interface SchoolSearchProps {
  id: string;
  value: DirectorySchool | null;
  onChange(school: DirectorySchool | null): void;
  invalid?: boolean;
  describedBy?: string;
}

export const SchoolSearch = forwardRef<HTMLInputElement, SchoolSearchProps>(function SchoolSearch(
  { id, value, onChange, invalid, describedBy },
  ref,
) {
  const { t } = useTranslation('auth');
  const { lang } = useLang();
  const listId = useId();
  const [text, setText] = useState('');
  const [typed, setTyped] = useState(false);
  const [results, setResults] = useState<DirectorySchool[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  const label = (s: DirectorySchool) => `${pickName(s, lang)}${s.city ? `, ${s.city}` : ''}`;
  const shown = typed ? text : value ? label(value) : text;

  useEffect(() => {
    if (!typed) return;
    const q = text.trim();
    const n = ++seq.current;
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchSchools(q)
      .then((r) => {
        if (n === seq.current) setResults(r);
      })
      .catch(() => {
        if (n === seq.current) setResults([]);
      })
      .finally(() => {
        if (n === seq.current) setSearching(false);
      });
  }, [text, typed]);

  function pick(s: DirectorySchool) {
    setTyped(false);
    setOpen(false);
    setText('');
    onChange(s);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={t('teacher.schoolPlaceholder')}
        value={shown}
        onChange={(e) => {
          setTyped(true);
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null);
        }}
        onFocus={() => typed && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={inputClass}
      />
      {open && typed && text.trim() !== '' && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-[10px] border border-line-strong bg-white p-1.5 shadow-[0_12px_30px_-12px_rgba(20,33,61,.3)]"
        >
          {results.length === 0 && (
            <p className="px-2.5 py-2 text-sm text-ink-muted">{searching ? t('teacher.searching') : t('teacher.noSchools')}</p>
          )}
          {results.map((s, i) => (
            <div
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className={cx(
                'cursor-pointer rounded-lg px-2.5 py-2 text-sm',
                i === active && 'bg-[color-mix(in_srgb,var(--brand)_10%,white)]',
              )}
            >
              <span className="font-semibold">{pickName(s, lang)}</span>
              {s.city && <span className="text-ink-muted">, {s.city}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
