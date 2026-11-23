// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { PeriodTemplate, PlanItem, SchoolClass } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { useAdminBase } from '../timetable/paths';
import { useToast } from '../../ui/Toast';
import { DeleteSetupModal } from '../teachers/DeleteSetupModal';
import * as api from './api';
import { AddGradeModal } from './AddGradeModal';
import { ClassCard } from './ClassCard';
import { ClassPlanModal } from './ClassPlanModal';
import { nextClassName, planCapacity } from './planModel';
import { PlanEditor } from './PlanEditor';

type Dialog = { kind: 'addGrade' } | { kind: 'deleteGrade' } | { kind: 'plan'; cls: SchoolClass } | { kind: 'delete'; cls: SchoolClass } | null;

export function GradesPage() {
  const { t } = useTranslation('grades');
  const school = useSchool();
  const readOnly = useReadOnly();
  const base = useAdminBase();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const sid = school.school.id;
  const grades = [...school.grades].sort((a, b) => a.number - b.number);
  const grade = grades.find((g) => g.id === selectedId) ?? grades[0];
  const gradeClasses = grade ? school.classes.filter((c) => c.gradeId === grade.id).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const defaultTemplate = school.templates.find((x) => x.isDefault) ?? school.templates[0];
  const classTemplates = gradeClasses.flatMap((c) => school.templates.filter((x) => x.id === c.templateId));
  const capacityTemplates: PeriodTemplate[] = classTemplates.length > 0 ? classTemplates : defaultTemplate ? [defaultTemplate] : [];
  const created = new Set(grades.map((g) => g.number));
  const pool = school.school.grades.length > 0 ? school.school.grades : Array.from({ length: 13 }, (_, i) => i + 1);
  const choices = pool.filter((n) => !created.has(n)).sort((a, b) => a - b);

  async function guard(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      toast.show(t('page.saveFailed'), 'error');
    }
  }

  const savePlan = (plan: PlanItem[]) => grade && guard(() => api.saveGradePlan(sid, grade.id, plan));

  const addClass = () => {
    if (!grade || !defaultTemplate) return;
    return guard(() =>
      api.addClass(sid, { gradeId: grade.id, name: nextClassName(grade.number, gradeClasses.map((c) => c.name)), templateId: defaultTemplate.id }),
    );
  };

  const addGradeButton = !readOnly && choices.length > 0 && (
    <Button variant="primary" onClick={() => setDialog({ kind: 'addGrade' })}>
      {t('rail.addGrade')}
    </Button>
  );

  return (
    <div>
      <PageHeader title={t('page.heading')} actions={addGradeButton || undefined} />
      <div className="flex min-h-[600px] gap-6">
      <nav aria-label={t('rail.title')} className="w-[150px] shrink-0 border-r border-line-soft pr-2.5">
        <p className="mx-2 mb-2.5 text-[11px] font-bold uppercase tracking-widest text-ink-muted">{t('rail.title')}</p>
        {grades.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-current={g.id === grade?.id ? 'page' : undefined}
            onClick={() => setSelectedId(g.id)}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              g.id === grade?.id ? 'bg-brand/10 font-bold text-brand' : 'text-ink-soft hover:bg-surface'
            }`}
          >
            {t('rail.grade', { n: g.number })}{' '}
            <span className="text-xs font-medium text-ink-muted">{school.classes.filter((c) => c.gradeId === g.id).length}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {school.loading ? (
          <LoadingState />
        ) : !grade ? (
          <EmptyState icon="grades" title={t('page.empty')} body={t('page.emptyBody')} action={addGradeButton || undefined} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-xl font-bold text-ink">{t('page.title', { n: grade.number })}</h2>
              {!readOnly && (
                <Button variant="danger" size="sm" onClick={() => setDialog({ kind: 'deleteGrade' })}>
                  {t('page.deleteGrade')}
                </Button>
              )}
            </div>

            <section className="mb-5 rounded-[14px] border border-line-soft bg-white p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="m-0 text-[17px] font-bold">{t('classes.title')}</h3>
                {!readOnly && defaultTemplate && (
                  <Button onClick={() => void addClass()}>
                    {t('classes.add', { name: nextClassName(grade.number, gradeClasses.map((c) => c.name)) })}
                  </Button>
                )}
              </div>
              {!readOnly && !defaultTemplate && (
                <p className="mb-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                  {t('classes.noTemplate')}
                  <LinkButton variant="primary" size="sm" to={`${base}/templates`}>
                    {t('classes.goTemplates')}
                  </LinkButton>
                </p>
              )}
              {gradeClasses.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('classes.empty')}</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                  {gradeClasses.map((c) => (
                    <ClassCard
                      key={c.id}
                      cls={c}
                      teachers={school.teachers}
                      templates={school.templates}
                      readOnly={readOnly}
                      onTeacher={(id) => void guard(() => api.updateClass(sid, c.id, { classTeacherId: id }))}
                      onTemplate={(id) => void guard(() => api.updateClass(sid, c.id, { templateId: id }))}
                      onCustomPlan={() => setDialog({ kind: 'plan', cls: c })}
                      onRemove={() => setDialog({ kind: 'delete', cls: c })}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[14px] border border-line-soft bg-white p-5">
              <PlanEditor
                plan={grade.plan}
                capacity={planCapacity(capacityTemplates)}
                subjects={school.subjects}
                readOnly={readOnly}
                onChange={(p) => void savePlan(p)}
              />
            </section>
          </>
        )}
        </div>
      </div>

      {dialog?.kind === 'addGrade' && (
        <AddGradeModal choices={choices} onAdd={(n) => guard(() => api.addGrade(sid, n))} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'plan' && grade && (
        <ClassPlanModal
          schoolId={sid}
          cls={dialog.cls}
          grade={grade}
          template={school.templates.find((x) => x.id === dialog.cls.templateId) ?? defaultTemplate!}
          subjects={school.subjects}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'deleteGrade' && grade && (
        <DeleteSetupModal
          schoolId={sid}
          kind="grade"
          id={grade.id}
          name={t('rail.grade', { n: grade.number })}
          body={
            gradeClasses.length > 0
              ? t('deleteGuard.body.grade', { ns: 'teachers', classes: gradeClasses.map((c) => c.name).join(', ') })
              : t('deleteGuard.body.gradeEmpty', { ns: 'teachers' })
          }
          onDeleted={() => setSelectedId(null)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal schoolId={sid} kind="class" id={dialog.cls.id} name={dialog.cls.name} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
