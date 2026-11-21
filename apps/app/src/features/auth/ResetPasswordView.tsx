// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { actionErrorKey, type ActionErrorKey } from './actionErrors';
import { ActionErrorView, ActionShell } from './ActionShell';
import { confirmNewPassword, getResetEmail } from './api';
import { useActionCode } from './useActionCode';

const MIN_LENGTH = 6;

export function ResetPasswordView({ code }: { code: string }) {
  const { t } = useTranslation('auth');
  const run = useCallback(() => getResetEmail(code), [code]);
  const state = useActionCode(run);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<ActionErrorKey | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setConfirmError(null);
    if (password.length < MIN_LENGTH) {
      setFieldError(t('action.errors.weak'));
      return;
    }
    if (password !== confirm) {
      setConfirmError(t('action.reset.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await confirmNewPassword(code, password);
      setDone(true);
    } catch (err) {
      const key = actionErrorKey(err);
      if (key === 'weak') setFieldError(t('action.errors.weak'));
      else if (key === 'network' || key === 'generic') setFieldError(t(`action.errors.${key}`));
      else setFatal(key);
      setBusy(false);
    }
  }

  const failure = fatal ?? (state.status === 'error' ? state.error : null);
  if (failure) {
    return <ActionErrorView message={t(`action.errors.${failure}`)} />;
  }
  if (done) {
    return (
      <ActionShell title={t('action.reset.doneTitle')}>
        <p className="mb-6 mt-0 text-ink-muted">{t('action.reset.doneBody')}</p>
        <Link
          to="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-navy px-5 text-[15px] font-semibold text-white no-underline"
        >
          {t('action.reset.toLogin')}
        </Link>
      </ActionShell>
    );
  }
  if (state.status !== 'done') {
    return (
      <ActionShell title={t('action.reset.title')}>
        <p className="m-0 text-ink-muted">{t('action.wait')}</p>
      </ActionShell>
    );
  }
  return (
    <ActionShell title={t('action.reset.title')}>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <p className="mb-5 mt-0 text-sm text-ink-muted">
          {t('action.reset.forAccount')} <strong className="text-ink">{state.value}</strong>
        </p>
        <Field label={t('action.reset.password')} hint={t('action.reset.hint')} error={fieldError} className="mb-[18px]">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t('action.reset.confirm')} error={confirmError} className="mb-6">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full !bg-navy !text-white" disabled={busy}>
          {t('action.reset.submit')}
        </Button>
      </form>
    </ActionShell>
  );
}
