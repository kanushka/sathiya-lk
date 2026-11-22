// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { useToast } from '../../ui/Toast';
import { claimInvites, signInWithGoogle, signInWithPassword } from './api';
import { sendAuthEmail } from './authEmail';
import { authErrorMessage, detailCode } from './errors';

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

export function AdminLoginForm({ autoFocus }: { autoFocus?: boolean }) {
  const { t } = useTranslation('auth');
  const { refreshClaims } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) emailRef.current?.focus();
  }, [autoFocus]);

  async function run(signIn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(authErrorMessage(err, t, 'errors.adminCredentials'));
      setBusy(false);
      return;
    }
    try {
      await claimInvites();
    } catch {
      // Invites are optional; sign-in already succeeded.
    }
    try {
      await refreshClaims();
    } catch {
      // Signed in; HomeRedirect decides from whatever claims are loaded.
    }
    navigate('/', { replace: true });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => signInWithPassword(email.trim(), password));
  }

  async function reset() {
    if (!email.trim()) {
      setError(t('admin.resetNeedsEmail'));
      return;
    }
    try {
      await sendAuthEmail({ kind: 'reset', email: email.trim(), lang });
      toast.show(t('admin.resetSent'), 'success');
    } catch (err) {
      if (detailCode(err) === 'rate-limited') toast.show(t('admin.resetRateLimited'), 'error');
      else toast.show(t('admin.resetSent'), 'success');
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="mb-1 mt-0 text-[26px] font-bold">{t('admin.title')}</h1>
      <p lang="si" className="mb-6 text-ink-muted font-[family-name:'Noto_Sans_Sinhala',Inter,sans-serif]">
        {t('admin.titleSi')}
      </p>
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
      >
        <GoogleLogo />
        {t('admin.google')}
      </Button>
      <div className="my-5 flex items-center gap-3 text-[13px] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        {t('admin.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Field label={t('admin.email')} className="mb-[18px]">
        <input
          className={inputClass}
          ref={emailRef}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={t('admin.password')} error={error} className="mb-2">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <p className="mb-6 mt-2 text-right text-sm">
        <Button variant="link" onClick={() => void reset()} className="underline">
          {t('admin.forgot')}
        </Button>
      </p>
      <Button
        type="submit"
        size="lg"
        className="w-full !bg-navy !text-white"
        disabled={busy || !email || !password}
      >
        {t('admin.submit')}
      </Button>
      <p className="mb-0 mt-5 text-center text-sm text-ink-muted">
        {t('admin.newSchool')}{' '}
        <Link to="/register" className="font-semibold">
          {t('admin.register')}
        </Link>
      </p>
    </form>
  );
}
