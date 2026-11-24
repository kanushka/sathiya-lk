// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';

export function InAppBrowserNotice() {
  const { t } = useTranslation('auth');
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="rounded-xl border border-warning-line bg-warning-soft px-4 py-3.5">
      <p className="m-0 text-sm font-bold text-ink">{t('inApp.title')}</p>
      <p className="mb-3 mt-1 text-sm text-ink-soft">{t('inApp.body')}</p>
      <Button variant="secondary" size="sm" onClick={() => void copy()}>
        {t('inApp.copy')}
      </Button>
      <p role="status" className="mb-0 mt-2 min-h-[1.25rem] text-[13px] text-ink-muted">
        {status === 'copied' ? t('inApp.copied') : status === 'failed' ? t('inApp.copyFailed') : ''}
      </p>
    </div>
  );
}
