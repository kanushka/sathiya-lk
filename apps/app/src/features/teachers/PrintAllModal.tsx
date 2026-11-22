// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';

export interface PrintAllModalProps {
  total: number;
  known: number;
  onPrintKnown: () => void;
  onResetAll: () => Promise<boolean>;
  onClose: () => void;
}

export function PrintAllModal({ total, known, onPrintKnown, onResetAll, onClose }: PrintAllModalProps) {
  const { t } = useTranslation('teachers');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resetAll() {
    setBusy(true);
    setFailed(false);
    const ok = await onResetAll();
    setBusy(false);
    if (!ok) setFailed(true);
  }

  if (confirming) {
    return (
      <Modal
        open
        width={460}
        title={t('printAll.confirmTitle')}
        onClose={() => setConfirming(false)}
        busy={busy}
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={busy}>{t('printAll.back')}</Button>
            <Button variant="dangerSolid" onClick={() => void resetAll()} loading={busy} loadingLabel={t('printAll.resetting')}>
              {t('printAll.confirmAction')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t('printAll.confirmBody')}</p>
        {failed && <FormError className="mt-3">{t('printAll.failed')}</FormError>}
      </Modal>
    );
  }

  return (
    <Modal
      open
      width={520}
      title={t('printAll.title')}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t('printAll.close')}</Button>}
    >
      <p className="m-0 text-sm text-ink-soft">{t('printAll.body')}</p>
      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Button variant="primary" onClick={onPrintKnown} disabled={known === 0}>
            {t('printAll.withKnown', { count: known })}
          </Button>
          <p className="m-0 mt-1.5 text-xs text-ink-muted">{t('printAll.knownHint', { count: known, total })}</p>
        </div>
        <div>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t('printAll.resetAll')}
          </Button>
          <p className="m-0 mt-1.5 text-xs text-ink-muted">{t('printAll.resetAllHint', { total })}</p>
        </div>
      </div>
    </Modal>
  );
}
