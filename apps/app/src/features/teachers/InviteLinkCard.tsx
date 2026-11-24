// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { CopyLink } from '../../ui/CopyLink';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';
import * as api from './api';
import { schoolJoinUrl } from './links';
import { useJoinLink } from './useJoinLink';

type Action = 'create' | 'off';

export function InviteLinkCard({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation('teachers');
  const headingId = useId();
  const link = useJoinLink(schoolId);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const listened = link.data?.token;
  const token = created ?? listened;

  // The listener can still hold the replaced token right after create; show ours until it catches up.
  useEffect(() => {
    if (created && listened === created) setCreated(null);
  }, [created, listened]);

  async function run(action: Action) {
    setBusy(action);
    setFailed(false);
    try {
      const res = await api.setJoinLink(schoolId, action);
      setCreated(action === 'create' && res.token ? res.token : null);
      setConfirming(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-line-soft bg-white p-5">
      <h2 id={headingId} className="m-0 text-[17px] font-bold">
        {t('inviteLink.title')}
      </h2>
      <p className="mb-0 mt-1 text-sm text-ink-soft">{t('inviteLink.body')}</p>
      {link.loading ? null : link.error ? (
        <FormError className="mt-2">{t('inviteLink.loadFailed')}</FormError>
      ) : token ? (
        <>
          <div className="mt-3">
            <CopyLink url={schoolJoinUrl(window.location.origin, schoolId, token)} copyLabel={t('inviteLink.copy')} hint={t('inviteLink.shareHint')} />
          </div>
          <div className="mt-3">
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              {t('inviteLink.off')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-0 mt-2 text-sm text-ink-muted">{t('inviteLink.isOff')}</p>
          <div className="mt-3">
            <Button size="sm" variant="primary" loading={busy === 'create'} onClick={() => void run('create')}>
              {t('inviteLink.create')}
            </Button>
          </div>
        </>
      )}
      {failed && !confirming && <FormError className="mt-2">{t('inviteLink.failed')}</FormError>}
      {confirming && (
        <Modal
          open
          width={460}
          title={t('inviteLink.confirmOffTitle')}
          onClose={() => setConfirming(false)}
          busy={busy !== null}
          footer={
            <>
              <Button onClick={() => setConfirming(false)} disabled={busy !== null}>
                {t('inviteLink.cancel')}
              </Button>
              <Button variant="dangerSolid" loading={busy === 'off'} onClick={() => void run('off')}>
                {t('inviteLink.confirmOff')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-sm text-ink-soft">{t('inviteLink.confirmOffBody')}</p>
          {failed && <FormError className="mt-3">{t('inviteLink.failed')}</FormError>}
        </Modal>
      )}
    </section>
  );
}
