// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { inputClass } from './Field';
import { Icon } from './Icon';

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useTranslation('common');
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={cx(inputClass, 'pr-11', className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={t('password.show')}
        title={shown ? t('password.hide') : t('password.show')}
        aria-pressed={shown}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}
