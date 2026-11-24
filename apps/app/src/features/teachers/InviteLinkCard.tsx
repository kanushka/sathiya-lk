// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { CopyLink } from '../../ui/CopyLink';
import { FormError } from '../../ui/FormError';
import * as api from './api';
import { schoolJoinUrl } from './links';

type LinkState = { kind: 'unknown' } | { kind: 'shown'; url: string } | { kind: 'off' };

export function InviteLinkCard({ schoolId }: { schoolId: string }) {
  const { t } = useTranslation('teachers');
  const headingId = useId();
  const [link, setLink] = useState<LinkState>({ kind: 'unknown' });
  const [busy, setBusy] = useState<'create' | 'off' | null>(null);
  const [failed, setFailed] = useState(false);

  async function run(action: 'create' | 'off') {
    setBusy(action);
    setFailed(false);
    try {
      const res = await api.setJoinLink(schoolId, action);
      setLink(action === 'off' || !res.token ? { kind: 'off' } : { kind: 'shown', url: schoolJoinUrl(window.location.origin, schoolId, res.token) });
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const create = (
    <Button variant={link.kind === 'shown' ? 'secondary' : 'primary'} size="sm" loading={busy === 'create'} disabled={busy === 'off'} onClick={() => void run('create')}>
      {link.kind === 'shown' ? t('inviteLink.replace') : t('inviteLink.create')}
    </Button>
  );
  const off = (
    <Button variant="ghost" size="sm" loading={busy === 'off'} disabled={busy === 'create'} onClick={() => void run('off')}>
      {t('inviteLink.off')}
    </Button>
  );

  return (
    <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-line-soft bg-white p-5">
      <h2 id={headingId} className="m-0 text-[17px] font-bold">
        {t('inviteLink.title')}
      </h2>
      <p className="mb-0 mt-1 text-sm text-ink-soft">{t('inviteLink.body')}</p>
      {link.kind === 'shown' ? (
        <div className="mt-3">
          <CopyLink url={link.url} copyLabel={t('inviteLink.copy')} hint={t('inviteLink.shareHint')} />
        </div>
      ) : (
        <p className="mb-0 mt-2 text-sm text-ink-muted">{link.kind === 'off' ? t('inviteLink.isOff') : t('inviteLink.hidden')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {create}
        {link.kind !== 'off' && off}
      </div>
      {failed && <FormError className="mt-2">{t('inviteLink.failed')}</FormError>}
    </section>
  );
}
