// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { nameTaken, pickName, usageCount, type Lang, type Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { ImportModal } from '../import/ImportModal';
import { DeleteSetupModal } from '../teachers/DeleteSetupModal';
import * as api from './api';
import { InlineInput } from './InlineInput';
import { SHORT_MAX } from './palette';
import { missingDefaults } from './standard';
import { SubjectModal } from './SubjectModal';

type Dialog = { kind: 'add' } | { kind: 'import' } | { kind: 'delete'; subject: Subject } | null;

export function SubjectsPage() {
  const { t, i18n } = useTranslation('subjects');
  const lang = i18n.language as Lang;
  const school = useSchool();
  const { entries } = useYear();
  const readOnly = useReadOnly();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [loading, setLoading] = useState(false);

  const subjects = [...school.subjects].sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  async function loadStandard() {
    setLoading(true);
    try {
      const toAdd = missingDefaults(school.subjects, await api.fetchDefaultSubjects());
      if (toAdd.length > 0) await api.addSubjects(school.school.id, toAdd);
      toast.show(t('page.loaded', { count: toAdd.length }), toAdd.length > 0 ? 'success' : 'info');
    } catch {
      toast.show(t('page.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function edit(s: Subject, patch: Partial<Omit<Subject, 'id'>>) {
    const others = school.subjects.filter((x) => x.id !== s.id);
    const clash = [
      patch.nameEn !== undefined && nameTaken(patch.nameEn, others.map((x) => x.nameEn)) ? patch.nameEn : null,
      patch.nameSi !== undefined && nameTaken(patch.nameSi, others.map((x) => x.nameSi)) ? patch.nameSi : null,
    ].find((n) => n !== null);
    if (clash) {
      toast.show(t('modal.errors.nameTaken', { name: clash }), 'error');
      return;
    }
    try {
      const { id: _id, ...current } = s;
      await api.updateSubject(school.school.id, s.id, { ...current, ...patch });
    } catch {
      toast.show(t('page.saveFailed'), 'error');
    }
  }

  const add = (
    <Button variant="primary" onClick={() => setDialog({ kind: 'add' })}>
      {t('page.add')}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.intro')}
        actions={
          !readOnly && (
            <>
              <Button onClick={() => void loadStandard()} loading={loading}>
                {t('page.loadStandard')}
              </Button>
              <Button onClick={() => setDialog({ kind: 'import' })}>{t('import:open')}</Button>
              {add}
            </>
          )
        }
      />

      {subjects.length === 0 ? (
        <EmptyState icon="subjects" title={t('page.empty')} body={t('page.emptyBody')} action={readOnly ? undefined : add} />
      ) : (
        <Table className="min-w-[720px]">
          <THead>
            <tr>
              <Th className="w-16">{t('page.cols.colour')}</Th>
              <Th>{t('page.cols.english')}</Th>
              <Th>{t('page.cols.sinhala')}</Th>
              <Th className="w-32">{t('page.cols.short')}</Th>
              <Th>{t('page.cols.usedIn')}</Th>
              {!readOnly && <Th className="w-24">{t('page.cols.actions')}</Th>}
            </tr>
          </THead>
          <TBody>
            {subjects.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <span
                    className="block h-[22px] w-[22px] rounded-md border border-black/10"
                    style={{ background: s.color }}
                    role="img"
                    aria-label={`${pickName(s, lang)} ${s.color}`}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.english', { name: pickName(s, lang) })}
                    value={s.nameEn}
                    required
                    readOnly={readOnly}
                    className="font-semibold"
                    onCommit={(v) => void edit(s, { nameEn: v })}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.sinhala', { name: pickName(s, lang) })}
                    value={s.nameSi ?? ''}
                    readOnly={readOnly}
                    onCommit={(v) => void edit(s, { nameSi: v })}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.short', { name: pickName(s, lang) })}
                    value={s.short}
                    required
                    maxLength={SHORT_MAX}
                    readOnly={readOnly}
                    onCommit={(v) => void edit(s, { short: v })}
                  />
                </Td>
                <Td className="text-[13px] text-ink-soft">{t('page.slots', { count: usageCount('subject', s.id, school, entries) })}</Td>
                {!readOnly && (
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'delete', subject: s })}>
                      {t('page.delete')}
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <p className="mt-3 text-[13px] text-ink-soft">{t('page.footnote')}</p>

      {dialog?.kind === 'add' && <SubjectModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'import' && <ImportModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal
          schoolId={school.school.id}
          kind="subject"
          id={dialog.subject.id}
          name={pickName(dialog.subject, lang)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
