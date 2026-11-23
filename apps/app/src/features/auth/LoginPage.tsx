// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Tabs, tabId, tabPanelId } from '../../ui/Tabs';
import { AdminLoginForm } from './AdminLoginForm';
import { BrandLockup, LanguageToggle } from './AuthChrome';
import { useDocumentTitle } from '../../lib/brand';
import { ReportSchoolModal } from './ReportSchoolModal';
import { TeacherLoginForm } from './TeacherLoginForm';

type LoginAs = 'admin' | 'teacher';

const ID_BASE = 'login-as';

export function LoginPage() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('pageTitle.login'));
  const [params, setParams] = useSearchParams();
  const [reporting, setReporting] = useState(() => params.get('report') === '1');
  const asParam = params.get('as');
  const as: LoginAs = asParam === 'teacher' || (asParam !== 'admin' && params.has('school')) ? 'teacher' : 'admin';
  const [focusField, setFocusField] = useState(as === 'teacher');
  // Arrow-key switching keeps focus on the tab (APG tabs pattern); clicks move it to the first field.
  const keyboardSwitch = useRef(false);

  function switchTo(next: LoginAs) {
    setFocusField(!keyboardSwitch.current);
    keyboardSwitch.current = false;
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'teacher') p.set('as', 'teacher');
        else if (p.has('school')) p.set('as', 'admin');
        else p.delete('as');
        return p;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandLockup />
      </div>
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-white px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7">
        <div
          onKeyDownCapture={(e) => {
            keyboardSwitch.current = ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key);
          }}
        >
          <Tabs<LoginAs>
            aria-label={t('switch.label')}
            variant="segmented"
            idBase={ID_BASE}
            value={as}
            onChange={(v) => {
              if (v !== as) switchTo(v);
            }}
            items={[
              { value: 'admin', label: t('switch.admin') },
              { value: 'teacher', label: t('switch.teacher') },
            ]}
            className="mb-6"
          />
        </div>
        <div role="tabpanel" id={tabPanelId(ID_BASE, as)} aria-labelledby={tabId(ID_BASE, as)}>
          {as === 'teacher' ? <TeacherLoginForm autoFocus={focusField} /> : <AdminLoginForm autoFocus={focusField} />}
        </div>
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
