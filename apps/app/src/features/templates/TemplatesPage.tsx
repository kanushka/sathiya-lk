// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { orphanedEntries, usageCount, type PeriodTemplate } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { Badge } from '../../ui/Badge';
import { useReadOnly } from '../../ui/AdminLayout';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/Toast';
import { DeleteSetupModal } from '../teachers/DeleteSetupModal';
import * as api from './api';
import { draftToTemplate, newlyOrphaned, periodCount, validateTemplate, type TemplateDraft, type ValidationError } from './model';
import { NewTemplateModal } from './NewTemplateModal';
import { ShrinkWarningModal } from './ShrinkWarningModal';
import { TemplateEditor } from './TemplateEditor';

type Dialog = { kind: 'new' } | { kind: 'delete' } | { kind: 'shrink'; count: number } | null;

function toDraft(t: PeriodTemplate): TemplateDraft {
  return { name: t.name, mode: t.mode, rows: t.rows, ...(t.mode === 'perDay' && t.days ? { days: t.days } : {}) };
}

export function TemplatesPage() {
  const school = useSchool();
  const { entries } = useYear();
  const readOnly = useReadOnly();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const sid = school.school.id;
  const templates = school.templates;
  const selected = templates.find((x) => x.id === selectedId) ?? templates.find((x) => x.isDefault) ?? templates[0];
  const { t } = useTranslation('templates');

  const orphans = orphanedEntries(entries, school).length;

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        actions={
          !readOnly && (
            <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
              {t('list.new')}
            </Button>
          )
        }
      />

      {orphans > 0 && (
        <Alert tone="danger" role="status" className="mb-5">
          {t('page.orphans', { n: orphans })}
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex w-[260px] flex-col gap-2.5">
          {templates.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === selected?.id ? 'true' : undefined}
              onClick={() => setSelectedId(x.id)}
              className={cx('rounded-xl bg-white px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2', x.id === selected?.id ? 'border-2 border-brand' : 'border border-line-soft')}
            >
              <strong className="block text-[15px]">{x.name}</strong>
              <span className="text-[13px] text-ink-soft">
                {t('list.summary', { periods: periodCount(x.rows), count: usageCount('template', x.id, school, entries) })}
              </span>
            </button>
          ))}
        </div>

        <section className="min-w-[520px] flex-1 rounded-[14px] border border-line-soft bg-white p-6">
          {selected ? (
            <TemplateDetail
              key={selected.id + JSON.stringify(selected)}
              template={selected}
              readOnly={readOnly}
              dialog={dialog}
              setDialog={setDialog}
            />
          ) : (
            <EmptyState icon="calendar" title={t('page.empty')} body={t('page.emptyBody')} />
          )}
        </section>
      </div>

      {dialog?.kind === 'new' && (
        <NewTemplateModal
          onClose={() => setDialog(null)}
          onCreate={async (name) => {
            const base = templates.find((x) => x.isDefault) ?? templates[0];
            await api.createTemplate(sid, name, base?.rows ?? []);
          }}
        />
      )}
    </div>
  );
}

interface DetailProps {
  template: PeriodTemplate;
  readOnly: boolean;
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
}

function TemplateDetail({ template, readOnly, dialog, setDialog }: DetailProps) {
  const { t } = useTranslation('templates');
  const school = useSchool();
  const { entries } = useYear();
  const toast = useToast();
  const [draft, setDraft] = useState<TemplateDraft>(() => toDraft(template));
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [pending, setPending] = useState<'save' | 'default' | null>(null);
  const sid = school.school.id;
  const classes = usageCount('template', template.id, school, entries);

  async function guard(kind: 'save' | 'default', fn: () => Promise<void>, ok?: string) {
    setPending(kind);
    try {
      await fn();
      if (ok) toast.show(ok, 'success');
    } catch {
      toast.show(t('page.saveFailed'), 'error');
    } finally {
      setPending(null);
    }
  }

  const persist = () =>
    guard(
      'save',
      () => api.saveTemplate(sid, template.id, { name: draft.name, mode: draft.mode, rows: draftToTemplate(template, draft).rows, ...(draft.mode === 'perDay' && draft.days ? { days: draft.days } : {}) }),
      t('page.saved'),
    );

  function save() {
    const found = validateTemplate(draft);
    setErrors(found);
    if (found.length > 0) return;
    const count = newlyOrphaned(entries, school, draftToTemplate(template, draft));
    if (count > 0) setDialog({ kind: 'shrink', count });
    else void persist();
  }

  const nameError = errors.some((e) => e.code === 'name');

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          {readOnly ? (
            <h2 className="m-0 text-lg font-bold">{draft.name}</h2>
          ) : (
            <input
              aria-label={t('editor.templateName')}
              aria-invalid={nameError || undefined}
              size={Math.max(draft.name.length, 4)}
              className="h-9 rounded-lg border border-transparent bg-transparent px-1 text-lg font-bold [field-sizing:content] hover:border-line-hover focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/30 aria-[invalid=true]:border-danger"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          )}
          {template.isDefault && <Badge tone="success" className="ml-2">{t('editor.default')}</Badge>}
          <p className="mb-0 mt-1 text-[13px] text-ink-soft">{t('editor.usedBy', { count: classes })}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {!template.isDefault && (
              <>
                <Button
                  loading={pending === 'default'}
                  disabled={pending === 'save'}
                  onClick={() => void guard('default', () => api.setDefaultTemplate(sid, template.id, school.templates.filter((x) => x.isDefault).map((x) => x.id)))}
                >
                  {t('editor.setDefault')}
                </Button>
                <Button variant="danger" disabled={pending !== null} onClick={() => setDialog({ kind: 'delete' })}>
                  {t('editor.delete')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <TemplateEditor draft={draft} errors={errors} readOnly={readOnly} onChange={setDraft} />

      {errors.length > 0 && (
        <ul role="alert" className="mb-0 mt-4 list-none p-0 text-sm font-medium text-danger">
          {errors.map((e, i) => (
            <li key={i}>{(e.day === null ? '' : t(`common:days.short.${e.day}`) + ': ') + t(`errors.${e.code}`, { row: (e.row ?? 0) + 1 })}</li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="mt-5 flex justify-end border-t border-line-soft pt-[18px]">
          <Button variant="primary" size="lg" loading={pending === 'save'} loadingLabel={t('busy.saving', { ns: 'common' })} disabled={pending === 'default'} onClick={save}>
            {t('editor.save')}
          </Button>
        </div>
      )}

      {dialog?.kind === 'shrink' && (
        <ShrinkWarningModal
          count={dialog.count}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void persist();
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal schoolId={sid} kind="template" id={template.id} name={template.name} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
