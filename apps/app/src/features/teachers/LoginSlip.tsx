// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { printSlips, type PrintLabels } from './printSlips';
import { qrSvgDataUri } from './qr';
import { slipText, whatsappUrl, type SlipData } from './slip';

export function usePrintLabels(): PrintLabels {
  const { t } = useTranslation('teachers');
  return {
    staffId: t('slip.staffId'),
    password: t('slip.password'),
    resetNeeded: t('slip.resetNeeded'),
    loginAt: t('slip.loginAt'),
    heading: t('slip.title'),
    hint: t('slip.resetHint'),
    title: t('print.title'),
  };
}

export interface LoginSlipProps {
  slip: SlipData;
  hasStaffId: boolean;
  onReset?: () => void;
  resetting?: boolean;
  resetError?: boolean;
  focusPrint?: boolean;
}

export function LoginSlip({ slip, hasStaffId, onReset, resetting, resetError, focusPrint }: LoginSlipProps) {
  const { t } = useTranslation('teachers');
  const labels = usePrintLabels();
  const [qr, setQr] = useState('');
  const printRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusPrint) printRef.current?.focus();
  }, [focusPrint]);

  useEffect(() => {
    let live = true;
    qrSvgDataUri(slip.url).then((uri) => live && setQr(uri), () => undefined);
    return () => {
      live = false;
    };
  }, [slip.url]);

  return (
    <section aria-label={t('slip.title')} className="flex flex-col gap-4">
      <h3 className="text-[13px] font-bold uppercase tracking-[.04em] text-ink-muted">{t('slip.title')}</h3>
      <div className="rounded-xl border border-dashed border-line-strong bg-[#FAFAFB] p-4 text-sm">
        <p className="font-bold text-ink">{slip.schoolName}</p>
        <p className="mt-1 text-ink-soft">
          {t('slip.staffId')} <b className="text-ink">{slip.staffId || '—'}</b>
        </p>
        <p className="mt-1 text-ink-soft">
          {t('slip.password')}{' '}
          {slip.password ? (
            <b className="font-mono text-base tracking-[.08em] text-ink">{slip.password}</b>
          ) : (
            <span className="text-ink-muted">{hasStaffId ? t('slip.resetHint') : t('slip.afterSave')}</span>
          )}
        </p>
        {slip.password && <p className="mt-1 text-xs text-ink-muted">{t('slip.shownOnce')}</p>}
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="break-all text-xs text-ink-muted">{slip.url}</p>
          {qr && <img src={qr} alt={t('slip.qrAlt')} width={80} height={80} className="shrink-0" />}
        </div>
      </div>
      {hasStaffId && (
        <div className="flex flex-wrap gap-2">
          <Button ref={printRef} size="sm" onClick={() => void printSlips([slip], labels)}>
            {t('slip.print')}
          </Button>
          <a
            href={whatsappUrl(slipText(slip, labels))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold text-ink hover:bg-slate-50"
          >
            {t('slip.whatsapp')}
          </a>
          {onReset && (
            <Button size="sm" variant="danger" onClick={onReset} disabled={resetting}>
              {resetting ? t('slip.resetting') : t('slip.reset')}
            </Button>
          )}
        </div>
      )}
      {resetError && (
        <p role="alert" className="text-xs font-medium text-danger">
          {t('slip.resetFailed')}
        </p>
      )}
    </section>
  );
}
