// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { useDeleteSetupItem, type SetupItemKind } from './useDeleteSetupItem';

export interface DeleteSetupModalProps {
  schoolId: string;
  kind: SetupItemKind;
  id: string;
  name: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteSetupModal({ schoolId, kind, id, name, onClose, onDeleted }: DeleteSetupModalProps) {
  const { t } = useTranslation('teachers');
  const toast = useToast();
  const del = useDeleteSetupItem();
  const blocked = del.usedIn !== null;

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
      footer={
        <>
          <Button onClick={onClose}>{blocked ? t('deleteGuard.close') : t('deleteGuard.cancel')}</Button>
          {!blocked && (
            <Button variant="danger" onClick={confirm} disabled={del.pending}>
              {t('deleteGuard.confirm')}
            </Button>
          )}
        </>
      }
    >
      {blocked ? (
        <p role="alert" className="text-sm font-semibold text-[#A3262A]">
          {t(`deleteGuard.inUse.${kind}`, { count: del.usedIn ?? 0 })}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">{t(`deleteGuard.body.${kind}`)}</p>
      )}
      {del.failed && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#A3262A]">
          {t('deleteGuard.failed')}
        </p>
      )}
    </Modal>
  );
}
