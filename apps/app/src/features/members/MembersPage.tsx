// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ADMIN_INVITE_TTL_MS, paths, teacherDisplayName, type Member } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { PendingNote, useSchoolPending } from '../../app/PendingReview';
import { useSchool } from '../../app/SchoolProvider';
import { toApiError } from '../../lib/callable';
import { useCollection } from '../../lib/firestore';
import { useReadOnly } from '../../ui/AdminLayout';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { CopyLink } from '../../ui/CopyLink';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { PageHeader } from '../../ui/PageHeader';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { useAdminBase } from '../timetable/paths';
import * as api from './api';
import { InviteModal } from './InviteModal';
import { RemoveAdminModal } from './RemoveAdminModal';

export function MembersPage() {
  const { t } = useTranslation('members');
  const { lang } = useLang();
  const { school, teachers } = useSchool();
  const readOnly = useReadOnly();
  const pending = useSchoolPending();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<{ uid: string; name: string; teacher: boolean } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const sid = school.id;
  const members = useCollection<Member & { id: string }>(paths.members(sid));
  const invites = useCollection<api.Invite>(paths.invites(sid));

  const rows = [...members.data]
    .map((m) => ({ m, teacher: m.teacherId ? teachers.find((x) => x.id === m.teacherId) : undefined }))
    .sort((a, b) => Number(b.m.role === 'admin') - Number(a.m.role === 'admin'));

  const adminCount = members.data.filter((m) => m.role === 'admin').length;
  const expiredBefore = Date.now() - ADMIN_INVITE_TTL_MS;

  async function remove(uid: string, name: string): Promise<string | null> {
    try {
      await api.removeAdmin(sid, uid);
      toast.show(t('remove.removed', { name }), 'success');
      if (user?.uid === uid) void signOut().catch(() => undefined);
      return null;
    } catch (err) {
      return t(toApiError(err).code === 'last-admin' ? 'remove.lastAdmin' : 'remove.failed');
    }
  }

  async function cancelInvite(email: string) {
    setCancelling(email);
    try {
      await api.cancelInvite(sid, email);
      toast.show(t('invites.cancelled', { email }), 'success');
    } catch {
      toast.show(t('invites.cancelFailed'), 'error');
    } finally {
      setCancelling(null);
    }
  }

  const adminLink = `${window.location.origin}/login`;
  const base = useAdminBase();

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        actions={
          !readOnly && (
            <div className="flex flex-col items-end gap-1.5">
              <Button
                variant="primary"
                disabled={pending}
                aria-describedby={pending ? 'invite-locked' : undefined}
                onClick={() => setInviting(true)}
              >
                {t('page.invite')}
              </Button>
              {pending && <PendingNote id="invite-locked" />}
            </div>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon="members" title={t('list.empty')} />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>{t('list.name')}</Th>
              <Th>{t('list.role')}</Th>
              <Th>{t('list.staffId')}</Th>
              <Th>{t('list.email')}</Th>
              {!readOnly && <Th>{t('list.actions')}</Th>}
            </Tr>
          </THead>
          <TBody>
            {rows.map(({ m, teacher }) => {
              const name = m.name ?? (teacher ? teacherDisplayName(teacher, lang) : (m.email ?? t('list.unknown')));
              return (
                <Tr key={m.uid}>
                  <Td>{name}</Td>
                  <Td>{t(m.role === 'admin' ? 'list.admin' : 'list.teacher')}</Td>
                  <Td>{teacher?.staffId ?? ''}</Td>
                  <Td>{m.email ?? teacher?.email ?? '—'}</Td>
                  {!readOnly && (
                    <Td>
                      {m.role === 'admin' && adminCount > 1 && (
                        <IconButton
                          icon="trash"
                          size="sm"
                          label={t('list.remove')}
                          className="hover:!bg-danger-soft hover:!text-danger"
                          onClick={() => setRemoving({ uid: m.uid, name, teacher: !!m.teacherId })}
                        />
                      )}
                    </Td>
                  )}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <section className="mt-6 rounded-[14px] border border-line-soft bg-white p-5">
        <h2 className="m-0 mb-3 text-[17px] font-bold">{t('invites.title')}</h2>
        {invites.data.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">{t('invites.none')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {invites.data.map((i) => {
              const linked = i.teacherId ? teachers.find((x) => x.id === i.teacherId) : undefined;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft py-2.5 text-sm first:border-t-0">
                  <strong>{i.email}</strong>
                  {linked && <span className="text-ink-muted">{t('invites.linked', { name: teacherDisplayName(linked, lang) })}</span>}
                  {typeof i.createdAt === 'number' && i.createdAt < expiredBefore && <Badge tone="warning">{t('invites.expired')}</Badge>}
                  {!readOnly && (
                    <IconButton
                      icon="trash"
                      size="sm"
                      label={t('invites.cancel')}
                      className="ml-auto hover:!bg-danger-soft hover:!text-danger"
                      loading={cancelling === i.email}
                      disabled={cancelling !== null}
                      onClick={() => void cancelInvite(i.email)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-[14px] border border-line-soft bg-white p-5">
        <h2 className="m-0 text-[17px] font-bold">{t('page.linkTitle')}</h2>
        <p className="mb-0 mt-1 text-sm text-ink-soft">{t('page.linkBody')}</p>
        <div className="mt-4">
          <CopyLink label={t('page.adminLink')} url={adminLink} copyLabel={t('page.copyAdmin')} />
        </div>
        <p className="mb-0 mt-4 text-sm text-ink-soft">
          {t('page.teachersJoin')}{' '}
          <Link to={`${base}/teachers`} className="font-semibold text-brand underline underline-offset-2">
            {t('page.teachersPage')}
          </Link>
        </p>
      </section>

      {removing && (
        <RemoveAdminModal
          name={removing.name}
          self={user?.uid === removing.uid}
          teacher={removing.teacher}
          onConfirm={() => remove(removing.uid, removing.name)}
          onClose={() => setRemoving(null)}
        />
      )}

      {inviting && !pending && (
        <InviteModal
          teachers={teachers}
          onClose={() => setInviting(false)}
          onInvite={async (email, teacherId) => {
            await api.inviteAdmin(sid, email, teacherId);
          }}
        />
      )}
    </div>
  );
}
