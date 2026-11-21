// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDoc, type DocState } from '../../lib/firestore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field, inputClass } from '../../ui/Field';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import { firestorePlatformWriter, hexColor, type DefaultSubject, type DefaultSubjectsDoc, type PlatformWriter } from './platform';

export interface DefaultSubjectsPageProps {
  doc?: DocState<DefaultSubjectsDoc>;
  writer?: PlatformWriter;
}

const blank: DefaultSubject = { nameEn: '', nameSi: '', short: '', color: '#0E6B6A' };

type Errors = Partial<Record<'nameEn' | 'short' | 'color', string>>;

function validate(s: DefaultSubject, t: (k: string) => string): Errors {
  const e: Errors = {};
  if (!s.nameEn.trim()) e.nameEn = t('subjects.errors.nameEn');
  if (!s.short.trim()) e.short = t('subjects.errors.shortRequired');
  else if (s.short.trim().length > 4) e.short = t('subjects.errors.shortLength');
  if (!hexColor.test(s.color)) e.color = t('subjects.errors.color');
  return e;
}

export function DefaultSubjectsPage({ doc: injected, writer = firestorePlatformWriter }: DefaultSubjectsPageProps) {
  const { t } = useTranslation('superadmin');
  const toast = useToast();
  const live = useDoc<DefaultSubjectsDoc>(injected ? null : paths.platform.defaultSubjects);
  const state = injected ?? live;
  const list = state.data?.subjects ?? [];
  const [editing, setEditing] = useState<{ index: number | null; draft: DefaultSubject } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = !state.loading && !state.error;

  async function persist(subjects: DefaultSubject[]): Promise<boolean> {
    if (!ready) return false;
    setBusy(true);
    try {
      await writer.saveDefaultSubjects({ subjects, updatedAt: Date.now() });
      toast.show(t('subjects.saved'), 'success');
      return true;
    } catch (err) {
      toast.show(t('subjects.failed', { message: errorMessage(t, err) }), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const draft = { ...editing.draft, nameEn: editing.draft.nameEn.trim(), nameSi: editing.draft.nameSi.trim(), short: editing.draft.short.trim() };
    const e = validate(draft, t);
    setErrors(e);
    if (Object.keys(e).length) return;
    const next = editing.index === null ? [...list, draft] : list.map((s, i) => (i === editing.index ? draft : s));
    if (await persist(next)) setEditing(null);
  }

  async function confirmDelete() {
    if (deleting === null) return;
    if (await persist(list.filter((_, i) => i !== deleting))) setDeleting(null);
  }

  const open = (index: number | null) => {
    if (!ready) return;
    setErrors({});
    setEditing({ index, draft: index === null ? blank : (list[index] ?? blank) });
  };
  const set = (patch: Partial<DefaultSubject>) => setEditing((c) => (c ? { ...c, draft: { ...c.draft, ...patch } } : c));
  const deletingName = deleting === null ? '' : (list[deleting]?.nameEn ?? '');

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[26px] font-bold">{t('subjects.title')}</h1>
          <p className="text-sm text-ink-muted">{t('subjects.intro')}</p>
        </div>
        <Button variant="primary" disabled={!ready} onClick={() => open(null)}>
          {t('subjects.add')}
        </Button>
      </div>
      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <EmptyState icon="search" title={t('subjects.loadError')} />
      ) : list.length === 0 ? (
        <EmptyState icon="search" title={t('subjects.empty')} body={t('subjects.emptyBody')} />
      ) : (
        <Table className="min-w-[640px]">
          <THead>
            <tr>
              <Th>{t('subjects.columns.nameEn')}</Th>
              <Th>{t('subjects.columns.nameSi')}</Th>
              <Th>{t('subjects.columns.short')}</Th>
              <Th>{t('subjects.columns.color')}</Th>
              <Th>{t('schools.columns.actions')}</Th>
            </tr>
          </THead>
          <TBody>
            {list.map((s, i) => (
              <Tr key={`${s.short}-${i}`}>
                <Td>
                  <strong>{s.nameEn}</strong>
                </Td>
                <Td>{s.nameSi}</Td>
                <Td>{s.short}</Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" style={{ background: s.color }} className="h-5 w-5 rounded-md border border-line" />
                    <span className="text-xs text-ink-muted">{s.color}</span>
                  </span>
                </Td>
                <Td>
                  <span className="flex gap-2">
                    <Button size="sm" aria-label={t('subjects.edit', { name: s.nameEn })} disabled={!ready} onClick={() => open(i)}>
                      {t('buttons.edit', { ns: 'common' })}
                    </Button>
                    <Button size="sm" variant="danger" aria-label={t('subjects.delete', { name: s.nameEn })} disabled={!ready} onClick={() => setDeleting(i)}>
                      {t('buttons.delete', { ns: 'common' })}
                    </Button>
                  </span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={editing !== null}
        title={editing?.index === null ? t('subjects.addTitle') : t('subjects.editTitle')}
        width={480}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void saveEdit()}>
              {t('buttons.save', { ns: 'common' })}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Field label={t('subjects.fields.nameEn')} error={errors.nameEn}>
              <input className={inputClass} value={editing.draft.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
            </Field>
            <Field label={t('subjects.fields.nameSi')}>
              <input className={inputClass} value={editing.draft.nameSi} onChange={(e) => set({ nameSi: e.target.value })} />
            </Field>
            <Field label={t('subjects.fields.short')} error={errors.short}>
              <input className={inputClass} value={editing.draft.short} onChange={(e) => set({ short: e.target.value })} />
            </Field>
            <Field label={t('subjects.fields.color')} error={errors.color}>
              <span className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label={t('subjects.fields.colorPicker')}
                  value={hexColor.test(editing.draft.color) ? editing.draft.color : '#000000'}
                  onChange={(e) => set({ color: e.target.value.toUpperCase() })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-white p-1"
                />
                <input className={inputClass} value={editing.draft.color} onChange={(e) => set({ color: e.target.value })} />
              </span>
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        title={t('subjects.confirmDelete.title', { name: deletingName })}
        width={460}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
              {t('subjects.confirmDelete.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t('subjects.confirmDelete.body')}</p>
      </Modal>
    </div>
  );
}
