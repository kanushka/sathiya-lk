// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { inputClass } from './Field';

export interface NameFieldsProps {
  legend?: ReactNode;
  // Full accessible names for the two inputs, e.g. "School name (English)"; the visible labels stay short.
  enLabel?: string;
  siLabel?: string;
  en: string;
  si: string;
  onEn: (v: string) => void;
  onSi: (v: string) => void;
  // Shown when neither name is filled in; marks both inputs invalid.
  missing?: boolean;
  enError?: ReactNode;
  siError?: ReactNode;
  enPlaceholder?: string;
  siPlaceholder?: string;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function NameFields({ legend, enLabel, siLabel, en, si, onEn, onSi, missing, enError, siError, enPlaceholder, siPlaceholder, hint, disabled, className }: NameFieldsProps) {
  const { t } = useTranslation('common');
  const id = useId();
  const noteId = `${id}-note`;
  const enErrId = `${id}-en-error`;
  const siErrId = `${id}-si-error`;
  const describe = (own: ReactNode, ownId: string) => [own ? ownId : null, noteId].filter(Boolean).join(' ');
  const input = (lang: 'en' | 'si', value: string, onChange: (v: string) => void, own: ReactNode, ownId: string, placeholder?: string) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`${id}-${lang}`} className="text-[13px] font-medium text-ink-soft">
        {t(lang === 'en' ? 'names.inEnglish' : 'names.inSinhala')}
      </label>
      <input
        id={`${id}-${lang}`}
        lang={lang}
        aria-label={lang === 'en' ? enLabel : siLabel}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={missing || own ? true : undefined}
        aria-describedby={describe(own, ownId)}
        onChange={(e) => onChange(e.target.value)}
      />
      {own && (
        <p id={ownId} role="alert" className="text-xs font-medium text-danger">
          {own}
        </p>
      )}
    </div>
  );
  return (
    <fieldset className={cx('m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0', className)} disabled={disabled}>
      <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ink-soft">
        {legend ?? t('names.legend')}
        <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
        <span className="ml-1.5 font-normal text-ink-muted">— {t('names.either')}</span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {input('en', en, onEn, enError, enErrId, enPlaceholder)}
        {input('si', si, onSi, siError, siErrId, siPlaceholder)}
      </div>
      {missing ? (
        <p id={noteId} role="alert" className="text-xs font-medium text-danger">
          {t('names.missing')}
        </p>
      ) : (
        <p id={noteId} className="text-xs text-ink-muted">
          {hint ?? t('names.hint')}
        </p>
      )}
    </fieldset>
  );
}
