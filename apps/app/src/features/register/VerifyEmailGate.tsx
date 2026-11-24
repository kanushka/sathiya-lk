// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { sendAuthEmail } from '../auth/authEmail';
import { detailCode } from '../auth/errors';
import * as api from './api';

export interface VerifyEmailGateProps {
  email?: string | null;
  purpose?: 'register' | 'signUp';
  onConfirmed(): void | Promise<void>;
}

export function VerifyEmailGate({ email, purpose = 'register', onConfirmed }: VerifyEmailGateProps) {
  const { t } = useTranslation('register');
  const { lang } = useLang();
  const [busy, setBusy] = useState<'confirm' | 'resend' | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  async function confirm() {
    setBusy('confirm');
    setMessage(null);
    try {
      if (await api.confirmVerified()) {
        await onConfirmed();
        return;
      }
      setMessage({ kind: 'error', text: t('verify.notYet') });
    } catch {
      setMessage({ kind: 'error', text: t('errors.generic') });
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    setBusy('resend');
    setMessage(null);
    try {
      await sendAuthEmail({ kind: 'verify', lang });
      setMessage({ kind: 'info', text: t('verify.sent') });
    } catch (err) {
      setMessage({ kind: 'error', text: t(detailCode(err) === 'rate-limited' ? 'errors.rateLimited' : 'verify.sendFailed') });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-[520px] rounded-2xl border-2 border-teal bg-white p-6 text-center sm:p-8">
      <span className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-[#E3F1F0] text-teal">
        <Icon name="mail" size={26} strokeWidth={2} />
      </span>
      <h2 className="mb-2 mt-0 text-xl font-bold">{t('verify.title')}</h2>
      <p className="mb-5 mt-0 text-sm leading-relaxed text-ink-muted">
        <Trans t={t} i18nKey={purpose === 'signUp' ? 'verify.bodySignUp' : 'verify.body'} values={{ email: email ?? '' }} components={{ b: <b className="text-ink" /> }} />
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" loading={busy === 'confirm'} disabled={busy === 'resend'} onClick={() => void confirm()}>
          {t('verify.confirmed')}
        </Button>
        <Button size="lg" loading={busy === 'resend'} disabled={busy === 'confirm'} onClick={() => void resend()}>
          {t('verify.resend')}
        </Button>
      </div>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mb-0 mt-4 text-sm font-medium ${message.kind === 'error' ? 'text-danger' : 'text-teal'}`}
        >
          {message.text}
        </p>
      )}
      <p className="mb-0 mt-5 text-[13px] text-ink-muted">{t('verify.note')}</p>
    </section>
  );
}
