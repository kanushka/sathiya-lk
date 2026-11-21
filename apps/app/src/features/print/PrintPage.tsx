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

export function PrintPage({ status, auto, notFoundTitle, notFoundBody, icon, children }: Props) {
  const { t } = useTranslation('print');
  const navigate = useNavigate();
  const printed = useRef(false);

  useEffect(() => {
    if (status === 'ready' && auto && !printed.current) {
      printed.current = true;
      window.print();
    }
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
    <div className="print-page">
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
