// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { CopyLink } from '../../ui/CopyLink';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';

export function PersonalLinkModal({ name, url, expiresAt, onClose }: { name: string; url: string; expiresAt: number; onClose: () => void }) {
  const { t, i18n } = useTranslation('teachers');
  const when = new Date(expiresAt).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Modal open width={520} title={t('personalLink.title', { name })} onClose={onClose} footer={<Button onClick={onClose}>{t('personalLink.done')}</Button>}>
      <p className="m-0 text-sm text-ink-soft">{t('personalLink.body', { name })}</p>
      <div className="mt-3">
        <CopyLink url={url} copyLabel={t('personalLink.copy')} />
      </div>
      <p className="mb-0 mt-3 text-xs text-ink-muted">{t('personalLink.expires', { when })}</p>
    </Modal>
  );
}

export function UnlinkModal({ name, self, onConfirm, onClose }: { name: string; self: boolean; onConfirm: () => Promise<string | null>; onClose: () => void }) {
  const { t } = useTranslation('teachers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Modal
      open
      width={460}
      title={t('unlink.title', { name })}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('unlink.cancel')}
          </Button>
          <Button variant="dangerSolid" loading={busy} onClick={() => void confirm()}>
            {t('unlink.confirm')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-ink-soft">{t('unlink.body')}</p>
      {self && <p className="mb-0 mt-3 text-sm font-semibold text-danger">{t('unlink.selfBody')}</p>}
      {error && <FormError className="mt-3">{error}</FormError>}
    </Modal>
  );
}
