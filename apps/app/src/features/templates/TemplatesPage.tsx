// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { orphanedEntries, usageCount, type DayIndex, type PeriodTemplate, type TemplatePatch, type TemplateRow } from '@sathiya/core';
import { useEffect, useRef, useState } from 'react';
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
import { toApiError } from '../../lib/callable';
import { DAY_INDEXES, draftToTemplate, periodCount, validateTemplate, type TemplateDraft, type ValidationError } from './model';
import { NewTemplateModal } from './NewTemplateModal';
import { ShrinkWarningModal } from './ShrinkWarningModal';
import { TemplateEditor } from './TemplateEditor';

type Dialog = { kind: 'new' } | { kind: 'delete' } | { kind: 'shrink'; count: number } | null;

const rowsOn = (t: TemplateDraft, d: DayIndex): TemplateRow[] => (t.mode === 'perDay' && t.days ? t.days[d] : t.rows);

function TimeChanges({ before, after, classes }: { before: TemplateDraft; after: TemplateDraft; classes: number }) {
  const { t } = useTranslation('templates');
  const { t: tc } = useTranslation('common');
  const days: (DayIndex | null)[] = before.mode === 'same' && after.mode === 'same' ? [null] : DAY_INDEXES;
  const lines: string[] = [];
  for (const d of days) {
    const prefix = d === null ? '' : `${tc(`days.short.${d}`)} `;
    const oldP = rowsOn(before, d ?? 0).filter((r) => r.type === 'period');
    const newP = rowsOn(after, d ?? 0).filter((r) => r.type === 'period');
    for (let i = 0; i < Math.max(oldP.length, newP.length); i++) {
      const label = prefix + tc('periods.periodN', { n: i + 1 });
      const o = oldP[i];
      const n = newP[i];
      if (o && !n) lines.push(t('editor.changeRemoved', { label }));
      else if (!o && n) lines.push(t('editor.changeAdded', { label, to: `${n.start}–${n.end}` }));
      else if (o && n && (o.start !== n.start || o.end !== n.end)) lines.push(t('editor.changeMoved', { label, from: `${o.start}–${o.end}`, to: `${n.start}–${n.end}` }));
    }
  }
  if (classes === 0 || lines.length === 0) return null;
  return (
    <Alert tone="warning" role="status" className="mt-4">
      <p className="m-0 font-semibold">{t('editor.changesTitle', { count: classes })}</p>
      <ul className="mb-0 mt-1.5 pl-5">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Alert>
  );
}

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

  const newButton = !readOnly && (
    <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
      {t('list.new')}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        actions={newButton}
        phoneActions={newButton || null}
      />

      {orphans > 0 && (
        <Alert tone="danger" role="status" className="mb-5">
          {t('page.orphans', { n: orphans })}
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex w-full flex-col gap-2.5 md:w-[260px]">
          {templates.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-current={x.id === selected?.id ? 'true' : undefined}
              onClick={() => setSelectedId(x.id)}
              className={cx('rounded-xl bg-white px-4 py-3.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2', x.id === selected?.id ? 'border-2 border-brand' : 'border border-line-soft')}
            >
              <strong className="block text-[15px]">{x.name}</strong>
              <span className="text-[13px] text-ink-soft">
                {t('list.summary', { periods: periodCount(x.rows), count: usageCount('template', x.id, school, entries) })}
              </span>
            </button>
          ))}
        </div>

        <section className="min-w-0 flex-1 rounded-[14px] border border-line-soft bg-white p-4 md:min-w-[520px] md:p-6">
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
  const [inUse, setInUse] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const sid = school.school.id;
  const classes = usageCount('template', template.id, school, entries);

  function showSaveError(err: unknown) {
    const e = toApiError(err);
    const count = (e.details as { count?: unknown } | undefined)?.count;
    if (e.code === 'template-in-use' && typeof count === 'number') setInUse(count);
    else toast.show(t(e.code === 'template-too-many-moves' ? 'page.tooManyMoves' : 'page.saveFailed'), 'error');
  }

  async function guard(kind: 'save' | 'default', fn: () => Promise<void>, ok?: string) {
    setPending(kind);
    try {
      await fn();
      if (ok) toast.show(ok, 'success');
    } catch (err) {
      showSaveError(err);
    } finally {
      setPending(null);
    }
  }

  const latest = useRef(draft);
  latest.current = draft;
  const checked = useRef<TemplatePatch | null>(null);
  const patchOf = (d: TemplateDraft): TemplatePatch => ({ name: d.name, mode: d.mode, rows: draftToTemplate(template, d).rows, ...(d.mode === 'perDay' && d.days ? { days: d.days } : {}) });
  const persist = (p: TemplatePatch) => guard('save', () => api.saveTemplateWithRemap(sid, template.id, p).then(() => undefined), t('page.saved'));

  async function check(): Promise<void> {
    setPending('save');
    try {
      const p = patchOf(latest.current);
      const res = await api.saveTemplateWithRemap(sid, template.id, p, true);
      if (!mounted.current) return;
      if (JSON.stringify(patchOf(latest.current)) !== JSON.stringify(p)) {
        return await check();
      }
      if (res.blocked > 0) setInUse(res.blocked);
      else if (res.orphaned > 0) {
        checked.current = p;
        setDialog({ kind: 'shrink', count: res.orphaned });
      } else {
        await api.saveTemplateWithRemap(sid, template.id, p);
        toast.show(t('page.saved'), 'success');
      }
    } catch (err) {
      showSaveError(err);
    } finally {
      setPending(null);
    }
  }

  function save() {
    const found = validateTemplate(draft);
    setErrors(found);
    setInUse(0);
    if (found.length > 0) return;
    if (classes > 0) void check();
    else void persist(patchOf(draft));
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
              className="h-9 rounded-lg border border-transparent bg-transparent px-1 text-lg font-bold [field-sizing:content] hover:border-line-hover focus:border-brand focus:outline-hidden focus:ring-[3px] focus:ring-brand/30 aria-[invalid=true]:border-danger"
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
      {!readOnly && <TimeChanges before={toDraft(template)} after={draft} classes={classes} />}

      {inUse > 0 && (
        <Alert tone="danger" role="alert" className="mt-4">
          {t('page.inUse', { count: inUse })}
        </Alert>
      )}

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
            const p = checked.current;
            if (p && JSON.stringify(patchOf(latest.current)) === JSON.stringify(p)) void persist(p);
            else void check();
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal schoolId={sid} kind="template" id={template.id} name={template.name} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
