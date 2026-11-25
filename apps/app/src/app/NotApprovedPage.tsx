// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isSchoolAdmin, pickName, type RemoveRegistrationReq, type School } from '@sathiya/core';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BrandMark, LanguageToggle } from '../features/auth/AuthChrome';
import { formatDate } from '../features/superadmin/format';
import { call } from '../lib/callable';
import { CONTACT_EMAIL } from '../lib/urls';
import { Badge } from '../ui/Badge';
import { Button, buttonClass } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { Modal } from '../ui/Modal';
import { SchoolSwitcher } from '../ui/SchoolSwitcher';
import { useToast } from '../ui/Toast';
import { useAuth } from './AuthProvider';
import { useLang } from './LangProvider';
import { forgetLastSchool, markSchoolRemoved, unmarkSchoolRemoved } from './schoolHome';

export type RemoveRegistrationFn = (req: RemoveRegistrationReq) => Promise<unknown>;

const defaultRemove: RemoveRegistrationFn = (req) => call('removeRegistration', req);

export interface NotApprovedPageProps {
  sid: string;
  school: Pick<School, 'nameEn' | 'nameSi' | 'review'>;
  remove?: RemoveRegistrationFn;
}

export function NotApprovedPage({ sid, school, remove = defaultRemove }: NotApprovedPageProps) {
  const { t } = useTranslation('shell');
  const { lang } = useLang();
  const { claims, refreshClaims, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = pickName(school, lang);
  const decidedAt = school.review?.decidedAt;
  const reason = school.review?.reason;
  const subject = encodeURIComponent(name);
  const admin = isSchoolAdmin(claims, sid);

  useEffect(() => forgetLastSchool(sid), [sid]);

  async function removeRegistration() {
    setBusy(true);
    setFailed(false);
    markSchoolRemoved(sid);
    try {
      await remove({ schoolId: sid });
    } catch {
      unmarkSchoolRemoved(sid);
      setFailed(true);
      setBusy(false);
      return;
    }
    void refreshClaims().catch(() => undefined);
    toast.show(t('notApproved.removed'), 'success');
    navigate('/', { replace: true });
  }

  if (!admin) {
    return (
      <Frame name={name} sid={sid} onSignOut={() => void signOut()}>
        <Badge tone="danger" dot>
          {t('notApproved.badge')}
        </Badge>
        <h1 id="not-approved-title" className="mb-2 mt-3.5 text-[26px] font-bold tracking-tight">
          {name}
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-ink-soft">{t('notApproved.teacherBody')}</p>
      </Frame>
    );
  }

  return (
    <Frame name={name} sid={sid} onSignOut={() => void signOut()}>
      <Badge tone="danger" dot>
        {t('notApproved.badge')}
      </Badge>
      <h1 id="not-approved-title" className="mb-2 mt-3.5 text-[26px] font-bold tracking-tight">
        {t('notApproved.title', { name })}
      </h1>
      <p className="m-0 text-[15px] leading-relaxed text-ink-soft">
        {decidedAt ? t('notApproved.bodyDate', { date: formatDate(decidedAt, lang) }) : t('notApproved.body')}
      </p>

      {reason && (
        <>
          <p className="mb-1.5 mt-5 text-[13px] font-semibold text-ink-muted">{t('notApproved.reason')}</p>
          <p className="m-0 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm leading-normal text-ink-soft">
            {reason}
          </p>
        </>
      )}

      <h2 className="mb-3 mt-7 text-[17px] font-bold">{t('notApproved.next')}</h2>
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-xl border border-line p-[18px]">
          <h3 className="m-0 text-[15px] font-bold">{t('notApproved.contactTitle')}</h3>
          <p className="m-0 flex-1 text-[13px] leading-normal text-ink-soft">{t('notApproved.contactBody')}</p>
          <div>
            <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className={buttonClass({ variant: 'primary' })}>
              {t('notApproved.contactButton', { email: CONTACT_EMAIL })}
            </a>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-xl border border-line p-[18px]">
          <h3 className="m-0 text-[15px] font-bold">{t('notApproved.removeTitle')}</h3>
          <p className="m-0 flex-1 text-[13px] leading-normal text-ink-soft">{t('notApproved.removeBody')}</p>
          <div>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              {t('notApproved.removeButton')}
            </Button>
          </div>
        </div>
      </div>
      <Modal
        open={confirming}
        width={480}
        title={t('notApproved.confirmTitle', { name })}
        onClose={() => setConfirming(false)}
        busy={busy}
        footer={
          <>
            <Button disabled={busy} onClick={() => setConfirming(false)}>
              {t('buttons.cancel', { ns: 'common' })}
            </Button>
            <Button variant="dangerSolid" loading={busy} onClick={() => void removeRegistration()}>
              {t('notApproved.confirm')}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm leading-normal text-ink-soft">{t('notApproved.confirmBody')}</p>
        {failed && <FormError className="mt-3">{t('notApproved.failed')}</FormError>}
      </Modal>
    </Frame>
  );
}

function Frame({ name, sid, onSignOut, children }: { name: string; sid: string; onSignOut: () => void; children: ReactNode }) {
  const { t } = useTranslation('shell');
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3.5 sm:px-7">
        <BrandMark size={32} />
        <strong className="text-sm">{name}</strong>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SchoolSwitcher current={sid} className="w-56" />
          <LanguageToggle />
          <Button variant="ghost" onClick={onSignOut}>
            {t('sidebar.signOut')}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-10 sm:py-14">
        <section
          aria-labelledby="not-approved-title"
          className="w-full max-w-[680px] self-start rounded-[14px] border border-line-soft bg-white p-5 sm:p-8"
        >
          {children}
        </section>
      </main>
    </div>
  );
}
