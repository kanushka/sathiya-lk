// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { FormError } from '../../ui/FormError';
import { useDeleteSetupItem, type SetupItemKind } from './useDeleteSetupItem';

export interface DeleteSetupModalProps {
  schoolId: string;
  kind: SetupItemKind;
  id: string;
  name: string;
  onClose: () => void;
  onDeleted?: () => void;
  body?: ReactNode;
  knownUsedIn?: number;
}

export function DeleteSetupModal({ schoolId, kind, id, name, onClose, onDeleted, body, knownUsedIn }: DeleteSetupModalProps) {
  const { t } = useTranslation('teachers');
  const toast = useToast();
  const del = useDeleteSetupItem();
  const usedIn = del.usedIn ?? (knownUsedIn && knownUsedIn > 0 ? knownUsedIn : null);
  const blocked = usedIn !== null;

  async function confirm() {
    const outcome = await del.run(schoolId, kind, id);
    if (outcome === 'deleted') {
      toast.show(t('deleteGuard.deleted', { name }), 'success');
      onDeleted?.();
      onClose();
    }
  }

  return (
    <Modal
      open
      width={460}
      title={t('deleteGuard.title', { name })}
      onClose={onClose}
      busy={del.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={del.pending}>{blocked ? t('deleteGuard.close') : t('deleteGuard.cancel')}</Button>
          {!blocked && (
            <Button variant="dangerSolid" onClick={confirm} loading={del.pending} loadingLabel={t('busy.deleting', { ns: 'common' })}>
              {t('deleteGuard.confirm')}
            </Button>
          )}
        </>
      }
    >
      {blocked ? (
        <FormError>{t(`deleteGuard.inUse.${kind}`, { count: usedIn ?? 0 })}</FormError>
      ) : (
        <p className="text-sm text-ink-soft">{body ?? t(`deleteGuard.body.${kind}`)}</p>
      )}
      {del.failed && (
        <FormError className="mt-3">{t(del.suspended ? 'shell:suspended.writeBlocked' : 'deleteGuard.failed')}</FormError>
      )}
    </Modal>
  );
}
