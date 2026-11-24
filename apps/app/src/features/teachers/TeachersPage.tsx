// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, teacherDisplayName, teacherIdOf, teacherNameMissing, usageCount, type Lang, type Teacher } from '@sathiya/core';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/AuthProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { inputClass } from '../../ui/Field';
import { LoadingState } from '../../ui/LoadingState';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { Badge } from '../../ui/Badge';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/Toast';
import { ImportModal } from '../import/ImportModal';
import { PersonalLinkModal, UnlinkModal } from './AccountDialogs';
import { accountActionError } from './accountErrors';
import * as api from './api';
import { DeleteSetupModal } from './DeleteSetupModal';
import { InviteLinkCard } from './InviteLinkCard';
import { JoinRequests } from './JoinRequestsSection';
import { useJoinRequests } from './useJoinRequests';
import { personalJoinUrl } from './links';
import { TeacherModal } from './TeacherModal';

type Dialog =
  | { kind: 'edit'; teacher?: Teacher }
  | { kind: 'import' }
  | { kind: 'delete'; teacher: Teacher }
  | { kind: 'personalLink'; teacher: Teacher; url: string; expiresAt: number }
  | { kind: 'unlink'; teacher: Teacher }
  | null;

function formatLogin(ts: number, lang: string): string {
  return new Date(ts).toLocaleDateString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TeachersPage() {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;
  const state = useSchool();
  const { school, teachers, subjects, classes } = state;
  const { entries, years, yearId } = useYear();
  const latestYearId = [...years].sort((a, b) => b.label.localeCompare(a.label, 'en', { numeric: true }))[0]?.id;
  const slotUsage = (teacherId: string) => (yearId === latestYearId ? usageCount('teacher', teacherId, state, entries) : 0);
  const readOnly = useReadOnly();
  const toast = useToast();
  const { user, claims, refreshClaims } = useAuth();
  const now = Date.now();
  const liveLink = (x: Teacher) => !x.uid && !!x.inviteExpiresAt && x.inviteExpiresAt > now;
  const requests = useJoinRequests(school.id).data;
  const pendingFor = useMemo(() => new Set(requests.map((r) => r.teacherId)), [requests]);
  const canLinkSelf = !readOnly && !teacherIdOf(claims, school.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(() => (params.get('new') === '1' && !readOnly ? { kind: 'edit' } : null));
  useEffect(() => {
    if (params.has('new')) setParams((p) => (p.delete('new'), p), { replace: true });
  }, [params, setParams]);

  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, pickName(s, lang)])), [subjects, lang]);
  const sorted = useMemo(() => [...teachers].sort((a, b) => a.staffId.localeCompare(b.staffId)), [teachers]);
  const q = search.trim().toLowerCase();
  const other: Lang = lang === 'si' ? 'en' : 'si';
  const rows = q
    ? sorted.filter((x) => [teacherDisplayName(x, 'en'), teacherDisplayName(x, 'si'), x.staffId].some((v) => v.toLowerCase().includes(q)))
    : sorted;

  async function act(key: string, run: () => Promise<void>) {
    setBusy(key);
    try {
      await run();
    } catch (err) {
      toast.show(accountActionError(err, t), 'error');
    } finally {
      setBusy(null);
    }
  }

  const personalLink = (x: Teacher) =>
    act(`link:${x.id}`, async () => {
      const res = await api.createTeacherLink(school.id, x.id);
      setDialog({ kind: 'personalLink', teacher: x, url: personalJoinUrl(window.location.origin, res.token), expiresAt: res.expiresAt });
    });

  const cancelLink = (x: Teacher) =>
    act(`cancel:${x.id}`, async () => {
      await api.cancelTeacherLink(school.id, x.id);
      toast.show(t('page.cancelled'), 'success');
    });

  const linkSelf = (x: Teacher) =>
    act(`self:${x.id}`, async () => {
      await api.linkSelf(school.id, x.id);
      toast.show(t('page.linkSelfDone'), 'success');
      await refreshClaims().catch(() => undefined);
    });

  async function unlink(x: Teacher): Promise<string | null> {
    try {
      await api.unlinkTeacher(school.id, x.id);
      toast.show(t('page.unlinked', { name: teacherDisplayName(x, lang) }), 'success');
      return null;
    } catch (err) {
      return accountActionError(err, t);
    }
  }

  function status(x: Teacher) {
    if (x.uid) {
      return (
        <>
          <Badge tone="success">{t('status.linked')}</Badge>
          <span className="mt-1 block text-xs text-ink-muted">
            {x.lastLoginAt ? t('status.lastLogin', { when: formatLogin(x.lastLoginAt, lang) }) : t('status.neverSignedIn')}
          </span>
        </>
      );
    }
    return (
      <>
        {pendingFor.has(x.id) ? <Badge tone="warning">{t('status.pending')}</Badge> : <Badge>{t('status.notLinked')}</Badge>}
        {liveLink(x) && (
          <span className="mt-1 block text-xs text-ink-muted">{t('status.linkUntil', { when: formatLogin(x.inviteExpiresAt!, lang) })}</span>
        )}
      </>
    );
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
          {!readOnly && <Button onClick={() => setDialog({ kind: 'import' })}>{t('import:open')}</Button>}
          {!readOnly && add}
          </>
        }
      />

      <JoinRequests schoolId={school.id} requests={requests} teachers={teachers} readOnly={readOnly} />
      {!readOnly && <InviteLinkCard schoolId={school.id} />}

      {state.loading ? (
        <LoadingState />
      ) : teachers.length === 0 ? (
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
              <Th>{t('page.cols.account')}</Th>
              {!readOnly && <Th>{t('page.cols.actions')}</Th>}
            </tr>
          </THead>
          <TBody>
            {rows.map((x) => (
              <Tr key={x.id}>
                <Td className="font-mono text-[13px]">{x.staffId}</Td>
                <Td>
                  <span className="font-semibold">{teacherDisplayName(x, lang)}</span>
                  {teacherNameMissing(x, lang) ? (
                    <Badge tone="warning" className="ml-2">{t(lang === 'si' ? 'common:names.noSi' : 'common:names.noEn')}</Badge>
                  ) : (
                    !teacherNameMissing(x, other) && <span className="block text-xs text-ink-muted">{teacherDisplayName(x, other)}</span>
                  )}
                </Td>
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
                <Td>{status(x)}</Td>
                {!readOnly && (
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'edit', teacher: x })}>
                        {t('page.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'delete', teacher: x })}>
                        {t('page.delete')}
                      </Button>
                      {x.uid ? (
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'unlink', teacher: x })}>
                          {t('actions.unlink')}
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" loading={busy === `link:${x.id}`} disabled={busy !== null} onClick={() => void personalLink(x)}>
                            {t('actions.personalLink')}
                          </Button>
                          {liveLink(x) && (
                            <Button size="sm" variant="ghost" loading={busy === `cancel:${x.id}`} disabled={busy !== null} onClick={() => void cancelLink(x)}>
                              {t('actions.cancelLink')}
                            </Button>
                          )}
                          {canLinkSelf && (
                            <Button size="sm" variant="ghost" loading={busy === `self:${x.id}`} disabled={busy !== null} onClick={() => void linkSelf(x)}>
                              {t('actions.thisIsMe')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {dialog?.kind === 'edit' && <TeacherModal key={dialog.teacher?.id ?? 'new'} teacher={dialog.teacher} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'import' && <ImportModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'personalLink' && (
        <PersonalLinkModal
          name={teacherDisplayName(dialog.teacher, lang)}
          url={dialog.url}
          expiresAt={dialog.expiresAt}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'unlink' && (
        <UnlinkModal name={teacherDisplayName(dialog.teacher, lang)} self={!!user && dialog.teacher.uid === user.uid} onConfirm={() => unlink(dialog.teacher)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal
          schoolId={school.id}
          kind="teacher"
          id={dialog.teacher.id}
          name={teacherDisplayName(dialog.teacher, lang)}
          knownUsedIn={slotUsage(dialog.teacher.id) + classes.filter((c) => c.classTeacherId === dialog.teacher.id).length}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
