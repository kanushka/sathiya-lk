// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { BrandLockup, LanguageToggle } from './AuthChrome';
import { useDocumentTitle } from '../../lib/brand';
import { isInAppBrowser } from './inAppBrowser';
import { returnPathFrom } from './returnPath';
import { ReportSchoolModal } from './ReportSchoolModal';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';

export function LoginPage() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('pageTitle.login'));
  const [params] = useSearchParams();
  const [reporting, setReporting] = useState(() => params.get('report') === '1');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [inApp] = useState(() => typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent));
  const registering = returnPathFrom(useLocation().state) === '/register';

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandLockup />
      </div>
      {registering && (
        <p role="status" className="mb-4 mt-0 w-full max-w-[460px] rounded-xl bg-[#E3F1F0] px-4 py-3 text-sm text-teal">
          {t('registerIntent')}
        </p>
      )}
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-white px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
        {mode === 'signUp' ? (
          <SignUpForm onSignIn={() => setMode('signIn')} />
        ) : (
          <SignInForm inAppBrowser={inApp} onCreateAccount={() => setMode('signUp')} />
        )}
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
