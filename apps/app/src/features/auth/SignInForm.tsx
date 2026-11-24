// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { PasswordInput } from '../../ui/PasswordInput';
import { useToast } from '../../ui/Toast';
import { signInWithGoogle, signInWithPassword } from './api';
import { sendAuthEmail } from './authEmail';
import { authErrorMessage, detailCode } from './errors';
import { InAppBrowserNotice } from './InAppBrowserNotice';
import { useFinishSignIn } from './returnPath';

export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" data-testid="google-logo">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export interface SignInFormProps {
  inAppBrowser?: boolean;
  onCreateAccount?(): void;
}

export function SignInForm({ inAppBrowser = false, onCreateAccount }: SignInFormProps) {
  const { t } = useTranslation('auth');
  const finish = useFinishSignIn();
  const toast = useToast();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'password' | null>(null);

  async function run(kind: 'google' | 'password', signIn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(authErrorMessage(err, t));
      setBusy(null);
      return;
    }
    await finish();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t('signIn.missing'));
      return;
    }
    void run('password', () => signInWithPassword(email.trim(), password));
  }

  async function reset() {
    if (!email.trim()) {
      setResetError(t('signIn.resetNeedsEmail'));
      return;
    }
    setResetError(null);
    try {
      await sendAuthEmail({ kind: 'reset', email: email.trim(), lang });
      toast.show(t('signIn.resetSent'), 'success');
    } catch (err) {
      if (detailCode(err) === 'rate-limited') toast.show(t('signIn.resetRateLimited'), 'error');
      else toast.show(t('signIn.resetSent'), 'success');
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="mb-6 mt-0 text-[26px] font-bold">{t('signIn.title')}</h1>
      {inAppBrowser ? (
        <InAppBrowserNotice />
      ) : (
        <div className="relative">
          <Badge tone="success" className="absolute -top-2.5 right-3 z-10">
            {t('signIn.recommended')}
          </Badge>
          <Button
            size="lg"
            className="w-full"
            loading={busy === 'google'}
            disabled={busy === 'password'}
            onClick={() => void run('google', signInWithGoogle)}
          >
            <GoogleLogo />
            {t('signIn.google')}
          </Button>
        </div>
      )}
      <div className="my-5 flex items-center gap-3 text-[13px] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        {t('signIn.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Field label={t('signIn.email')} error={resetError} className="mb-[18px]">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResetError(null);
          }}
        />
      </Field>
      <Field label={t('signIn.password')} error={error} className="mb-2">
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <p className="mb-6 mt-2 text-right text-sm">
        <Button variant="link" onClick={() => void reset()} className="underline">
          {t('signIn.forgot')}
        </Button>
      </p>
      <Button
        type="submit"
        size="lg"
        className="w-full !bg-navy !text-white"
        loading={busy === 'password'}
        disabled={busy === 'google'}
      >
        {t('signIn.submit')}
      </Button>
      {onCreateAccount && (
        <p className="mb-0 mt-5 text-center text-sm text-ink-muted">
          {t('signIn.noAccount')}{' '}
          <Button variant="link" onClick={onCreateAccount} className="font-semibold underline">
            {t('signIn.createAccount')}
          </Button>
        </p>
      )}
      <p className="mb-0 mt-3 text-center text-sm text-ink-muted">
        {t('signIn.newSchool')}{' '}
        <Link to="/register" className="font-semibold">
          {t('signIn.register')}
        </Link>
      </p>
    </form>
  );
}
