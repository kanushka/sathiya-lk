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
  readOnly: boolean;
  onPrintKnown: () => void;
  onResetAll: () => Promise<{ failed: number } | null>;
  onClose: () => void;
}

type View = { kind: 'options' } | { kind: 'confirm' } | { kind: 'done'; failed: number };

export function PrintAllModal({ total, known, readOnly, onPrintKnown, onResetAll, onClose }: PrintAllModalProps) {
  const { t } = useTranslation('teachers');
  const [view, setView] = useState<View>({ kind: 'options' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resetAll() {
    setBusy(true);
    setFailed(false);
    const result = await onResetAll();
    setBusy(false);
    if (result) setView({ kind: 'done', failed: result.failed });
    else setFailed(true);
  }

  if (view.kind === 'done') {
    return (
      <Modal
        key="done"
        open
        width={460}
        title={t('printAll.doneTitle')}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>{t('printAll.close')}</Button>
            <Button variant="primary" onClick={onPrintKnown}>
              {t('printAll.printReset', { count: known })}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-ink-soft">{t('printAll.doneBody')}</p>
        {view.failed > 0 && <FormError className="mt-3">{t('page.printPartial', { count: view.failed })}</FormError>}
      </Modal>
    );
  }

  if (view.kind === 'confirm') {
    return (
      <Modal
        key="confirm"
        open
        width={460}
        title={t('printAll.confirmTitle')}
        onClose={() => setView({ kind: 'options' })}
        busy={busy}
        footer={
          <>
            <Button onClick={() => setView({ kind: 'options' })} disabled={busy}>{t('printAll.back')}</Button>
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
      key="options"
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
        {!readOnly && (
          <div>
            <Button variant="danger" onClick={() => setView({ kind: 'confirm' })}>
              {t('printAll.resetAll')}
            </Button>
            <p className="m-0 mt-1.5 text-xs text-ink-muted">{t('printAll.resetAllHint', { total })}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
