// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Lang, type Teacher } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { inputClass } from '../../ui/Field';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { DeleteSetupModal } from './DeleteSetupModal';
import { usePrintLabels } from './LoginSlip';
import { printSlips } from './printSlips';
import { useSessionPasswords } from './sessionPasswords';
import { teacherLoginUrl } from './slip';
import { TeacherModal } from './TeacherModal';

type Dialog = { kind: 'edit'; teacher?: Teacher } | { kind: 'delete'; teacher: Teacher } | null;

function formatLogin(ts: number | undefined, lang: string, never: string): string {
  return ts ? new Date(ts).toLocaleDateString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : never;
}

export function TeachersPage() {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;
  const { school, teachers, subjects, classes } = useSchool();
  const readOnly = useReadOnly();
  const toast = useToast();
  const { passwords } = useSessionPasswords();
  const printLabels = usePrintLabels();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, pickName(s, lang)])), [subjects, lang]);
  const sorted = useMemo(() => [...teachers].sort((a, b) => a.staffId.localeCompare(b.staffId)), [teachers]);
  const q = search.trim().toLowerCase();
  const rows = q ? sorted.filter((x) => x.name.toLowerCase().includes(q) || x.staffId.toLowerCase().includes(q)) : sorted;

  async function printAll() {
    const url = teacherLoginUrl(window.location.origin, school.id);
    const slips = sorted.map((x) => ({
      schoolName: pickName(school, lang),
      staffId: x.staffId,
      name: x.name,
      password: passwords[x.id],
      url,
    }));
    if (!(await printSlips(slips, printLabels))) toast.show(t('page.printBlocked'), 'error');
  }

  const add = (
    <Button variant="primary" onClick={() => setDialog({ kind: 'edit' })}>
      {t('page.add')}
    </Button>
  );

  return (
    <div className="mx-auto max-w-[1100px] p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-bold text-ink">{t('page.title')}</h1>
        <span className="rounded-full bg-[#F1F2F5] px-2.5 py-0.5 text-sm font-semibold text-ink-soft">{teachers.length}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label={t('page.search')}
            placeholder={t('page.search')}
            className={`${inputClass} w-64`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={() => void printAll()} disabled={teachers.length === 0}>
            {t('page.printAll')}
          </Button>
          {!readOnly && add}
        </div>
      </div>

      {teachers.length === 0 ? (
        <EmptyState icon="teachers" title={t('page.empty')} body={t('page.emptyBody')} action={readOnly ? undefined : add} />
      ) : rows.length === 0 ? (
        <EmptyState icon="search" title={t('page.noMatch')} />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>{t('page.cols.staffId')}</Th>
              <Th>{t('page.cols.name')}</Th>
              <Th>{t('page.cols.teaches')}</Th>
              <Th>{t('page.cols.grades')}</Th>
              <Th>{t('page.cols.maxPerDay')}</Th>
              <Th>{t('page.cols.classTeacher')}</Th>
              <Th>{t('page.cols.login')}</Th>
              {!readOnly && <Th>{t('page.cols.actions')}</Th>}
            </tr>
          </THead>
          <TBody>
            {rows.map((x) => (
              <Tr key={x.id}>
                <Td className="font-mono text-[13px]">{x.staffId}</Td>
                <Td className="font-semibold">{x.name}</Td>
                <Td>
                  {x.isPrimary ? (
                    <span className="inline-block rounded-md bg-[#FBF1DC] px-2 py-0.5 text-xs font-semibold text-[#7A5410]">
                      {t('page.primaryTeacher')}
                    </span>
                  ) : (
                    x.subjectIds.map((id) => (
                      <span key={id} className="mb-1 mr-1 inline-block rounded-md bg-[#F1F2F5] px-2 py-0.5 text-xs font-semibold">
                        {subjectName.get(id) ?? id}
                      </span>
                    ))
                  )}
                </Td>
                <Td>{[...x.grades].sort((a, b) => a - b).join(', ')}</Td>
                <Td>{x.maxPerDay}</Td>
                <Td>{classes.filter((c) => c.classTeacherId === x.id).map((c) => c.name).join(', ')}</Td>
                <Td className={x.lastLoginAt ? 'text-ink-soft' : 'text-[#B4441C]'}>
                  {formatLogin(x.lastLoginAt, lang, t('page.neverLoggedIn'))}
                </Td>
                {!readOnly && (
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'edit', teacher: x })}>
                        {t('page.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'delete', teacher: x })}>
                        {t('page.delete')}
                      </Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {dialog?.kind === 'edit' && <TeacherModal key={dialog.teacher?.id ?? 'new'} teacher={dialog.teacher} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal
          schoolId={school.id}
          kind="teacher"
          id={dialog.teacher.id}
          name={dialog.teacher.name}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
