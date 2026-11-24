// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, type School } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark, LanguageToggle } from '../features/auth/AuthChrome';
import { ReportSchoolModal } from '../features/auth/ReportSchoolModal';
import { webUrl } from '../lib/urls';
import { Button } from '../ui/Button';
import { SchoolSwitcher } from '../ui/SchoolSwitcher';
import { useAuth } from './AuthProvider';
import { useLang } from './LangProvider';

export function SuspendedSchool({ sid, school }: { sid: string; school: Pick<School, 'nameEn' | 'nameSi'> }) {
  const { t } = useTranslation('shell');
  const { lang } = useLang();
  const { signOut } = useAuth();
  const [reporting, setReporting] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandMark />
      </div>
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-white px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
        <h1 className="mb-2 mt-0 text-[22px] font-bold">{t('suspended.title')}</h1>
        <p className="mb-1 mt-0 font-semibold text-ink">{pickName(school, lang)}</p>
        <p className="mb-6 mt-0 text-sm leading-normal text-ink-soft">{t('suspended.body')}</p>
        <div className="flex flex-col gap-3">
          <SchoolSwitcher current={sid} className="w-full" />
          <a
            className="font-semibold text-brand underline underline-offset-2"
            href={webUrl(`${lang === 'si' ? '/si' : ''}/contact/`)}
            target="_blank"
            rel="noreferrer"
          >
            {t('suspended.contact')}
          </a>
          <Button variant="link" className="self-start underline" onClick={() => setReporting(true)}>
            {t('suspended.report')}
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => void signOut()}>
            {t('sidebar.signOut')}
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
      <ReportSchoolModal open={reporting} onClose={() => setReporting(false)} initialSchoolId={sid} />
    </div>
  );
}
