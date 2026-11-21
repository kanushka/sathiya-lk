// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
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

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#5A6378" strokeWidth="2" />
      <path d="M12 12h8" stroke="#5A6378" strokeWidth="2" />
    </svg>
  );
}

export function AdminLoginForm() {
  const { t } = useTranslation('auth');
  const { refreshClaims } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <form
      onSubmit={submit}
      noValidate
      className="w-full max-w-[460px] flex-1 basis-[400px] rounded-2xl border border-line bg-white p-5 sm:p-8"
    >
      <p className="m-0 text-[13px] font-bold uppercase tracking-[.06em] text-teal">{t('admin.eyebrow')}</p>
      <h1 className="mb-1 mt-1.5 text-[26px] font-bold">{t('admin.title')}</h1>
      <p lang="si" className="mb-6 text-ink-muted font-[family-name:'Noto_Sans_Sinhala',Inter,sans-serif]">
        {t('admin.titleSi')}
      </p>
      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
      >
        <GoogleMark />
        {t('admin.google')}
      </Button>
      <div className="my-5 flex items-center gap-3 text-[13px] text-[#8A91A3]">
        <span className="h-px flex-1 bg-line" />
        {t('admin.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Field label={t('admin.email')} className="mb-[18px]">
        <input
          className={inputClass}
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
        <button type="button" onClick={() => void reset()} className="cursor-pointer border-0 bg-transparent p-0 text-brand underline">
          {t('admin.forgot')}
        </button>
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
