// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatAmount, pickName, teacherDisplayName, teacherLoad, teacherNameMissing, usageCount, type Lang, type Teacher } from '@sathiya/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/AuthProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Icon, type IconName } from '../../ui/Icon';
import { cx } from '../../ui/cx';
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
  const { user, signOut } = useAuth();
  const isSelf = (x: Teacher) => !!user && x.uid === user.uid;
  const now = Date.now();
  const liveLink = (x: Teacher) => !x.uid && !!x.inviteExpiresAt && x.inviteExpiresAt > now;
  const requests = useJoinRequests(school.id).data;
  const pendingFor = useMemo(() => new Set(requests.map((r) => r.teacherId)), [requests]);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const teachersReady = !state.loading && !state.error;
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(() => (params.get('new') === '1' && !readOnly && teachersReady ? { kind: 'edit' } : null));
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  useEffect(() => {
    if (!params.has('new') || !teachersReady) return;
    if (params.get('new') === '1' && !readOnly) setDialog((d) => d ?? { kind: 'edit' });
    setParams((p) => (p.delete('new'), p), { replace: true });
  }, [params, setParams, teachersReady, readOnly]);

  const loads = useMemo(() => new Map(state.teachers.map((x) => [x.id, teacherLoad(x.id, entries, state)])), [state, entries]);
  const loadText = (x: Teacher) => {
    const load = loads.get(x.id);
    if (!load) return '0';
    return load.timedMinutes > 0 ? `${load.entries} · ${formatAmount(load.timedMinutes, 'minutes', lang)}` : String(load.entries);
  };

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
      // Never replace a dialog the admin opened while waiting: it may hold unsaved input.
      if (dialogRef.current) toast.show(t('page.linkHidden', { name: teacherDisplayName(x, lang) }), 'info');
      else setDialog({ kind: 'personalLink', teacher: x, url: personalJoinUrl(window.location.origin, res.token), expiresAt: res.expiresAt });
    });

  const cancelLink = (x: Teacher) =>
    act(`cancel:${x.id}`, async () => {
      await api.cancelTeacherLink(school.id, x.id);
      toast.show(t('page.cancelled'), 'success');
    });

  async function unlink(x: Teacher): Promise<string | null> {
    try {
      await api.unlinkTeacher(school.id, x.id);
      toast.show(t('page.unlinked', { name: teacherDisplayName(x, lang) }), 'success');
      if (isSelf(x)) void signOut().catch(() => undefined);
      return null;
    } catch (err) {
      return accountActionError(err, t);
    }
  }

  function hint(icon: IconName, label: string, tone: string) {
    return (
      <span title={label} className={cx('inline-flex', tone)}>
        <Icon name={icon} size={15} label={label} />
      </span>
    );
  }

  function status(x: Teacher) {
    if (x.uid) {
      const login = x.lastLoginAt ? t('status.lastLogin', { when: formatLogin(x.lastLoginAt, lang) }) : null;
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <Badge tone="success">{t('status.linked')}</Badge>
          {login ? (
            <span title={login} className="text-xs text-ink-muted">
              <span className="sr-only">{login}</span>
              <span aria-hidden="true">{new Date(x.lastLoginAt!).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</span>
            </span>
          ) : (
            hint('clock', t('status.neverSignedIn'), 'text-warning')
          )}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        {pendingFor.has(x.id) ? <Badge tone="warning">{t('status.pending')}</Badge> : <Badge>{t('status.notLinked')}</Badge>}
        {liveLink(x) && hint('link', t('status.linkUntil', { when: formatLogin(x.inviteExpiresAt!, lang) }), 'text-brand')}
      </span>
    );
  }

  const add = (
    <Button variant="primary" disabled={!teachersReady} onClick={() => setDialog({ kind: 'edit' })}>
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
          {!readOnly && <Button disabled={!teachersReady} onClick={() => setDialog({ kind: 'import' })}>{t('import:open')}</Button>}
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
              <Th>{t('page.cols.load')}</Th>
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
                  <div className="flex flex-wrap gap-1">
                    {x.isPrimary ? (
                      <Badge tone="warning">{t('page.primaryTeacher')}</Badge>
                    ) : (
                      x.subjectIds.map((id) => <Badge key={id}>{subjectName.get(id) ?? id}</Badge>)
                    )}
                  </div>
                </Td>
                <Td>{[...x.grades].sort((a, b) => a - b).join(', ')}</Td>
                <Td>
                  {x.maxPerDay}
                  {x.minPerWeek !== undefined && <span className="block text-xs text-ink-muted">{t('page.minPerWeek', { n: x.minPerWeek })}</span>}
                </Td>
                <Td>{loadText(x)}</Td>
                <Td>{classes.filter((c) => c.classTeacherId === x.id).map((c) => c.name).join(', ')}</Td>
                <Td>{status(x)}</Td>
                {!readOnly && (
                  <Td>
                    <div className="flex items-center gap-0.5">
                      <IconButton icon="edit" size="sm" label={t('page.edit')} onClick={() => setDialog({ kind: 'edit', teacher: x })} />
                      {x.uid ? (
                        <IconButton icon="unlink" size="sm" label={t('actions.unlink')} onClick={() => setDialog({ kind: 'unlink', teacher: x })} />
                      ) : (
                        <>
                          <IconButton icon="link" size="sm" label={t('actions.personalLink')} loading={busy === `link:${x.id}`} disabled={busy !== null} onClick={() => void personalLink(x)} />
                          {liveLink(x) && (
                            <IconButton icon="linkOff" size="sm" label={t('actions.cancelLink')} loading={busy === `cancel:${x.id}`} disabled={busy !== null} onClick={() => void cancelLink(x)} />
                          )}
                        </>
                      )}
                      <IconButton icon="trash" size="sm" label={t('page.delete')} className="hover:!bg-danger-soft hover:!text-danger" onClick={() => setDialog({ kind: 'delete', teacher: x })} />
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
        <UnlinkModal name={teacherDisplayName(dialog.teacher, lang)} self={isSelf(dialog.teacher)} onConfirm={() => unlink(dialog.teacher)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal
          schoolId={school.id}
          kind="teacher"
          id={dialog.teacher.id}
          name={teacherDisplayName(dialog.teacher, lang)}
          knownUsedIn={slotUsage(dialog.teacher.id) + classes.filter((c) => c.classTeacherId === dialog.teacher.id).length}
          {...(isSelf(dialog.teacher) && {
            body: (
              <>
                {t('deleteGuard.body.teacher')}
                <span className="mt-3 block font-semibold text-danger">{t('unlink.selfBody')}</span>
              </>
            ),
            onDeleted: () => void signOut().catch(() => undefined),
          })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
