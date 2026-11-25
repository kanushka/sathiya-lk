// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isSchoolPendingError } from '../../app/PendingReview';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import type { PublishProblems } from './model';

const kinds = ['incomplete', 'clashes', 'overLimit', 'overTarget', 'orphaned', 'groupNoTeacher'] as const;

export interface PublishModalProps {
  yearLabel: string;
  problems: PublishProblems;
  onPublish: () => Promise<string>;
  onClose: () => void;
}

export function PublishModal({ yearLabel, problems, onPublish, onClose }: PublishModalProps) {
  const { t } = useTranslation('dashboard');
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (saving) return;
    setSaving(true);
    try {
      toast.show(await onPublish(), 'success');
      onClose();
    } catch (err) {
      toast.show(isSchoolPendingError(err) ? t('shell:review.locked') : t('publish.failed'), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={460}
      title={t('publish.title', { year: yearLabel })}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>{t('publish.cancel')}</Button>
          <Button variant="primary" onClick={() => void confirm()} loading={saving} loadingLabel={t('busy.publishing', { ns: 'common' })}>
            {t(problems.total > 0 ? 'publish.confirmAnyway' : 'publish.confirm')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-ink-soft">{t('publish.body')}</p>
      {problems.total > 0 && (
        <div className="mt-3 text-sm text-danger">
          <p className="m-0 font-semibold">{t('publish.problemsTitle', { count: problems.total })}</p>
          <ul className="mb-0 mt-1 pl-5">
            {kinds.filter((k) => problems[k] > 0).map((k) => (
              <li key={k}>{t(`publish.problems.${k}`, { count: problems[k] })}</li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
