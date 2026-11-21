// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Grade, PeriodTemplate, PlanItem, SchoolClass, Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import * as api from './api';
import { PlanEditor } from './PlanEditor';
import { planCapacity } from './planModel';

export interface ClassPlanModalProps {
  schoolId: string;
  cls: SchoolClass;
  grade: Grade;
  template: PeriodTemplate;
  subjects: Subject[];
  onClose: () => void;
}

export function ClassPlanModal({ schoolId, cls, grade, template, subjects, onClose }: ClassPlanModalProps) {
  const { t } = useTranslation('grades');
  const toast = useToast();
  const [plan, setPlan] = useState<PlanItem[]>(() => structuredClone(cls.planOverride ?? grade.plan));
  const [saving, setSaving] = useState(false);

  async function run(next: PlanItem[] | null) {
    setSaving(true);
    try {
      await api.setPlanOverride(schoolId, cls.id, next);
      toast.show(next === null ? t('classPlan.cleared', { name: cls.name }) : t('classPlan.saved', { name: cls.name }), 'success');
      onClose();
    } catch {
      toast.show(t('page.saveFailed'), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={760}
      title={t('classPlan.title', { name: cls.name })}
      subtitle={t('classPlan.subtitle')}
      onClose={onClose}
      footer={
        <>
          {cls.planOverride && (
            <Button className="mr-auto" onClick={() => void run(null)} disabled={saving}>
              {t('classPlan.useGrade')}
            </Button>
          )}
          <Button onClick={onClose}>{t('classPlan.cancel')}</Button>
          <Button variant="primary" onClick={() => void run(plan)} disabled={saving}>
            {t('classPlan.save')}
          </Button>
        </>
      }
    >
      <PlanEditor plan={plan} capacity={planCapacity([template])} subjects={subjects} readOnly={false} onChange={setPlan} />
    </Modal>
  );
}
