// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, teacherDisplayName, type Lang, type Teacher } from '@sathiya/core';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { inputClass } from '../../ui/Field';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { Badge } from '../../ui/Badge';
import { PageHeader } from '../../ui/PageHeader';
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
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(() => (params.get('new') === '1' && !readOnly ? { kind: 'edit' } : null));
  useEffect(() => {
    if (params.has('new')) setParams((p) => (p.delete('new'), p), { replace: true });
  }, [params, setParams]);

  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, pickName(s, lang)])), [subjects, lang]);
  const sorted = useMemo(() => [...teachers].sort((a, b) => a.staffId.localeCompare(b.staffId)), [teachers]);
  const q = search.trim().toLowerCase();
  const rows = q ? sorted.filter((x) => teacherDisplayName(x, lang).toLowerCase().includes(q) || x.staffId.toLowerCase().includes(q)) : sorted;

  async function printAll() {
    const url = teacherLoginUrl(window.location.origin, school.id);
    const slips = sorted.map((x) => ({
      schoolName: pickName(school, lang),
      staffId: x.staffId,
      name: teacherDisplayName(x, lang),
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
    <div>
      <PageHeader
        title={t('page.title')}
        count={teachers.length}
        actions={
          <>
          <div className="w-[220px]">
            <input
              type="search"
              aria-label={t('page.search')}
              placeholder={t('page.search')}
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => void printAll()} disabled={teachers.length === 0}>
            {t('page.printAll')}
          </Button>
          {!readOnly && add}
          </>
        }
      />

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
                <Td className="font-semibold">{teacherDisplayName(x, lang)}</Td>
                <Td>
                  {x.isPrimary ? (
                    <Badge tone="warning">{t('page.primaryTeacher')}</Badge>
                  ) : (
                    x.subjectIds.map((id) => (
                      <Badge key={id} className="mb-1 mr-1">
                        {subjectName.get(id) ?? id}
                      </Badge>
                    ))
                  )}
                </Td>
                <Td>{[...x.grades].sort((a, b) => a - b).join(', ')}</Td>
                <Td>{x.maxPerDay}</Td>
                <Td>{classes.filter((c) => c.classTeacherId === x.id).map((c) => c.name).join(', ')}</Td>
                <Td>
                  <span className={x.lastLoginAt ? 'text-ink-soft' : 'text-danger'}>
                    {formatLogin(x.lastLoginAt, lang, t('page.neverLoggedIn'))}
                  </span>
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
          name={teacherDisplayName(dialog.teacher, lang)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
