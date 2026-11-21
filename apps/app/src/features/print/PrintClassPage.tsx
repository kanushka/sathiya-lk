// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { PrintPage } from './PrintPage';
import { PrintSheet } from './PrintSheet';
import { usePrintSnapshot } from './usePrintSnapshot';

export function PrintClassPage() {
  const { t } = useTranslation('print');
  const { lang } = useLang();
  const { school } = useSchool();
  const { id } = useParams();
  const { status, snapshot, auto } = usePrintSnapshot('class', id);
  return (
    <PrintPage status={status} auto={auto} icon="classView" notFoundTitle={t('states.classNotFoundTitle')} notFoundBody={t('states.classNotFoundBody')}>
      {snapshot && <PrintSheet kind="class" snapshot={snapshot} lang={lang} {...(school.logoUrl ? { logoUrl: school.logoUrl } : {})} />}
    </PrintPage>
  );
}
