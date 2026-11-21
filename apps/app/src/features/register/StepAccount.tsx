// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import type { AccountDraft } from './model';

export const TERMS_URL = 'https://sathiya.lk/terms';
export const PRIVACY_URL = 'https://sathiya.lk/privacy';

export function accountOk(a: AccountDraft, signedIn: boolean): boolean {
  if (!a.terms || a.adminName.trim() === '') return false;
  return signedIn || (/^\S+@\S+\.\S+$/.test(a.email.trim()) && a.password.length >= 6);
}

export interface StepAccountProps {
  value: AccountDraft;
  onChange(next: AccountDraft): void;
  signedInEmail?: string | null;
  signedIn: boolean;
  busy: boolean;
  error?: { field: 'email' | 'password' | null; message: string } | null;
  onBack(): void;
  onSubmit(): void;
}

export function StepAccount({ value, onChange, signedIn, signedInEmail, busy, error, onBack, onSubmit }: StepAccountProps) {
  const { t } = useTranslation('register');
  const set = <K extends keyof AccountDraft>(k: K, v: AccountDraft[K]) => onChange({ ...value, [k]: v });

  return (
    <section className="rounded-2xl border-2 border-teal bg-white p-5 sm:p-7">
      <h2 className="mb-4 mt-0 text-lg font-bold">{t('account.title')}</h2>
      {signedIn && signedInEmail && <p className="mb-3 mt-0 text-sm text-ink-muted">{t('account.signedInAs', { email: signedInEmail })}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <Field label={t('account.name')} className="flex-[1_1_220px]">
          <input className={inputClass} autoComplete="name" value={value.adminName} onChange={(e) => set('adminName', e.target.value)} />
        </Field>
        {!signedIn && (
          <>
            <Field
              label={t('account.email')}
              className="flex-[1_1_220px]"
              error={error?.field === 'email' ? error.message : undefined}
            >
              <input
                className={inputClass}
                type="email"
                autoComplete="email"
                value={value.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field
              label={t('account.password')}
              hint={t('account.passwordHint')}
              className="flex-[1_1_220px]"
              error={error?.field === 'password' ? error.message : undefined}
            >
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={value.password}
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <label className="flex items-start gap-2.5 text-sm leading-normal">
        <input
          type="checkbox"
          className="mt-[3px] h-[18px] w-[18px]"
          checked={value.terms}
          onChange={(e) => set('terms', e.target.checked)}
        />
        <span>
          <Trans
            t={t}
            i18nKey="account.terms"
            components={{
              terms: <a href={TERMS_URL} target="_blank" rel="noreferrer" />,
              privacy: <a href={PRIVACY_URL} target="_blank" rel="noreferrer" />,
            }}
          />
        </span>
      </label>
      {error && error.field === null && (
        <p role="alert" className="mb-0 mt-4 text-sm font-medium text-[#A3262A]">
          {error.message}
        </p>
      )}
      <div className="mt-7 flex justify-between border-t border-line-soft pt-5">
        <Button size="lg" onClick={onBack} disabled={busy}>
          {t('back')}
        </Button>
        <Button variant="primary" size="lg" disabled={busy || !accountOk(value, signedIn)} onClick={onSubmit}>
          {busy ? t('account.submitting') : t('account.submit')}
        </Button>
      </div>
    </section>
  );
}
