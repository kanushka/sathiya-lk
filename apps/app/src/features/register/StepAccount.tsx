// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Checkbox } from '../../ui/Checkbox';
import { webUrl } from '../../lib/urls';
import { Field, inputClass } from '../../ui/Field';
import { FormError } from '../../ui/FormError';
import { passwordLongEnough } from '../../lib/password';
import type { AccountDraft } from './model';

export function legalUrl(page: 'terms' | 'privacy', lang: string): string {
  return webUrl(`${lang === 'si' ? '/si' : ''}/${page}/`);
}

export function accountOk(a: AccountDraft, signedIn: boolean): boolean {
  if (!a.terms || a.adminName.trim() === '') return false;
  return signedIn || (/^\S+@\S+\.\S+$/.test(a.email.trim()) && passwordLongEnough(a.password));
}

export interface StepAccountProps {
  value: AccountDraft;
  onChange(next: AccountDraft): void;
  signedInEmail?: string | null;
  signedIn: boolean;
  busy: boolean;
  error?: { field: 'email' | 'password' | null; message: string } | null;
  mode?: 'register' | 'signUp';
  onBack?(): void;
  onSubmit(): void;
}

export function StepAccount({ value, onChange, signedIn, signedInEmail, busy, error, mode = 'register', onBack, onSubmit }: StepAccountProps) {
  const { t, i18n } = useTranslation('register');
  const k = mode === 'signUp' ? 'signUp' : 'account';
  const set = <K extends keyof AccountDraft>(k: K, v: AccountDraft[K]) => onChange({ ...value, [k]: v });

  return (
    <section className={mode === 'signUp' ? '' : 'rounded-2xl border-2 border-teal bg-white p-5 sm:p-7'}>
      {mode === 'signUp' ? (
        <h1 className="mb-6 mt-0 text-[26px] font-bold">{t('signUp.title')}</h1>
      ) : (
        <h2 className="mb-4 mt-0 text-lg font-bold">{t('account.title')}</h2>
      )}
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
      <Checkbox
        checked={value.terms}
        onChange={(checked) => set('terms', checked)}
        label={
          <Trans
            t={t}
            i18nKey={`${k}.terms`}
            components={{
              terms: <a href={legalUrl('terms', i18n.language)} target="_blank" rel="noreferrer" />,
              privacy: <a href={legalUrl('privacy', i18n.language)} target="_blank" rel="noreferrer" />,
            }}
          />
        }
      />
      {error && error.field === null && (
        <FormError className="mb-0 mt-4">{error.message}</FormError>
      )}
      <div className={cx('mt-7 flex border-t border-line-soft pt-5', onBack ? 'justify-between' : 'justify-end')}>
        {onBack && (
          <Button size="lg" onClick={onBack} disabled={busy}>
            {t('back')}
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          loading={busy}
          loadingLabel={t(`${k}.submitting`)}
          disabled={!accountOk(value, signedIn)}
          onClick={onSubmit}
        >
          {t(`${k}.submit`)}
        </Button>
      </div>
    </section>
  );
}
