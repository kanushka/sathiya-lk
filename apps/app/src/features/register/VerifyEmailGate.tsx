// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import * as api from './api';

export interface VerifyEmailGateProps {
  email?: string | null;
  onConfirmed(): void;
}

export function VerifyEmailGate({ email, onConfirmed }: VerifyEmailGateProps) {
  const { t } = useTranslation('register');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      if (await api.confirmVerified()) {
        onConfirmed();
        return;
      }
      setMessage({ kind: 'error', text: t('verify.notYet') });
    } catch {
      setMessage({ kind: 'error', text: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      await api.resendVerification();
      setMessage({ kind: 'info', text: t('verify.sent') });
    } catch {
      setMessage({ kind: 'error', text: t('verify.sendFailed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[520px] rounded-2xl border-2 border-teal bg-white p-6 text-center sm:p-8">
      <h2 className="mb-2 mt-0 text-xl font-bold">{t('verify.title')}</h2>
      <p className="mb-5 mt-0 text-sm leading-relaxed text-ink-muted">{t('verify.body', { email: email ?? '' })}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void confirm()}>
          {t('verify.confirmed')}
        </Button>
        <Button size="lg" disabled={busy} onClick={() => void resend()}>
          {t('verify.resend')}
        </Button>
      </div>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mb-0 mt-4 text-sm font-medium ${message.kind === 'error' ? 'text-[#A3262A]' : 'text-teal'}`}
        >
          {message.text}
        </p>
      )}
      <p className="mb-0 mt-5 text-[13px] text-ink-muted">{t('verify.note')}</p>
    </section>
  );
}
