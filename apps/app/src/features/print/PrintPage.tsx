// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { LoadingState } from '../../ui/LoadingState';
import type { PrintStatus } from './usePrintSnapshot';
import './print.css';

interface Props {
  status: PrintStatus;
  auto: boolean;
  notFoundTitle: string;
  notFoundBody: string;
  icon: 'classView' | 'teacherView';
  children: ReactNode;
}

const ASSET_TIMEOUT_MS = 3000;

function imageReady(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

function assetsReady(root: HTMLElement | null): Promise<void> {
  const fonts = typeof document.fonts?.ready?.then === 'function' ? document.fonts.ready.then(() => undefined) : Promise.resolve();
  const images = Array.from(root?.querySelectorAll<HTMLImageElement>('.print-sheet img') ?? []).map(imageReady);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, ASSET_TIMEOUT_MS));
  return Promise.race([Promise.all([fonts, ...images]).then(() => undefined), timeout]);
}

export function PrintPage({ status, auto, notFoundTitle, notFoundBody, icon, children }: Props) {
  const { t } = useTranslation('print');
  const navigate = useNavigate();
  const printed = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== 'ready' || !auto || printed.current) return;
    printed.current = true;
    let cancelled = false;
    let fired = false;
    void assetsReady(pageRef.current).then(() => {
      if (cancelled) return;
      fired = true;
      window.print();
    });
    return () => {
      cancelled = true;
      // StrictMode re-runs effects before the print fires; let that run schedule it again.
      if (!fired) printed.current = false;
    };
  }, [status, auto]);

  if (status === 'loading') return <LoadingState />;
  if (status === 'error') return <EmptyState icon={icon} title={t('states.errorTitle')} body={t('states.errorBody')} />;
  if (status === 'notPublished') return <EmptyState icon={icon} title={t('states.notPublishedTitle')} body={t('states.notPublishedBody')} />;
  if (status === 'notFound') return <EmptyState icon={icon} title={notFoundTitle} body={notFoundBody} />;

  function close() {
    window.close();
    if (!window.closed) navigate(-1);
  }

  return (
    <div ref={pageRef} className="print-page">
      <div className="print-toolbar">
        <Button variant="primary" onClick={() => window.print()}>
          <Icon name="print" size={16} />
          {t('toolbar.print')}
        </Button>
        <Button onClick={close}>{t('toolbar.close')}</Button>
      </div>
      {children}
    </div>
  );
}
