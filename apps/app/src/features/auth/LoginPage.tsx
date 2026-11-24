// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { BrandLockup, LanguageToggle } from './AuthChrome';
import { useDocumentTitle } from '../../lib/brand';
import { isInAppBrowser } from './inAppBrowser';
import { ReportSchoolModal } from './ReportSchoolModal';
import { SignInForm } from './SignInForm';

export function LoginPage() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('pageTitle.login'));
  const [params] = useSearchParams();
  const [reporting, setReporting] = useState(() => params.get('report') === '1');
  const [inApp] = useState(() => typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent));

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandLockup />
      </div>
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-white px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
        <SignInForm inAppBrowser={inApp} />
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
      <p className="mb-0 mt-4 text-center text-[13px] text-ink-muted">
        {t('report.prompt')}{' '}
        <Button variant="link" onClick={() => setReporting(true)} className="underline">
          {t('report.link')}
        </Button>
      </p>
      <ReportSchoolModal open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
}
