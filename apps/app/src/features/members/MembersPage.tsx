// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, teacherDisplayName, type Member } from '@sathiya/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useCollection } from '../../lib/firestore';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PageHeader } from '../../ui/PageHeader';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { qrSvgDataUri } from '../teachers/qr';
import { teacherLoginUrl } from '../teachers/slip';
import * as api from './api';
import { InviteModal } from './InviteModal';

export function MembersPage() {
  const { t } = useTranslation('members');
  const { lang } = useLang();
  const { school, teachers } = useSchool();
  const readOnly = useReadOnly();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const sid = school.id;
  const members = useCollection<Member & { id: string }>(paths.members(sid));
  const invites = useCollection<api.Invite>(paths.invites(sid));

  const rows = [...members.data]
    .map((m) => ({ m, teacher: m.teacherId ? teachers.find((x) => x.id === m.teacherId) : undefined }))
    .sort((a, b) => Number(b.m.role === 'admin') - Number(a.m.role === 'admin'));

  const teacherLink = teacherLoginUrl(window.location.origin, sid);
  const adminLink = `${window.location.origin}/login`;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    qrSvgDataUri(teacherLink).then((uri) => live && setQr(uri), () => undefined);
    return () => {
      live = false;
    };
  }, [teacherLink]);

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        actions={
          !readOnly && (
            <Button variant="primary" onClick={() => setInviting(true)}>
              {t('page.invite')}
            </Button>
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
            </Tr>
          </THead>
          <TBody>
            {rows.map(({ m, teacher }) => (
              <Tr key={m.uid}>
                <Td>{m.name ?? (teacher ? teacherDisplayName(teacher, lang) : (m.email ?? t('list.unknown')))}</Td>
                <Td>{t(m.role === 'admin' ? 'list.admin' : 'list.teacher')}</Td>
                <Td>{teacher?.staffId ?? ''}</Td>
                <Td>{m.email ?? teacher?.email ?? '—'}</Td>
              </Tr>
            ))}
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-[14px] border border-line-soft bg-white p-5">
        <h2 className="m-0 text-[17px] font-bold">{t('page.linkTitle')}</h2>
        <p className="mb-0 mt-1 text-sm text-ink-soft">{t('page.linkBody')}</p>
        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <CopyLink label={t('page.teacherLink')} hint={t('page.teacherLinkHint')} url={teacherLink} copyLabel={t('page.copyTeacher')} />
            <CopyLink label={t('page.adminLink')} url={adminLink} copyLabel={t('page.copyAdmin')} />
          </div>
          {qr && <img src={qr} alt={t('page.qrAlt')} width={112} height={112} className="shrink-0 rounded-lg border border-line-soft" />}
        </div>
      </section>

      {inviting && (
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

function CopyLink({ label, hint, url, copyLabel }: { label: string; hint?: string; url: string; copyLabel: string }) {
  const { t } = useTranslation('members');
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.show(t('page.copyFailed'), 'error');
    }
  }

  return (
    <div className="min-w-0">
      <p className="m-0 text-[13px] font-semibold text-ink-soft">{label}</p>
      {hint && <p className="m-0 text-xs text-ink-muted">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <code className="min-w-0 break-all text-sm text-brand">{url}</code>
        <Button size="sm" aria-label={copyLabel} onClick={() => void copy()}>
          <span aria-live="polite">{copied ? t('page.copied') : t('page.copy')}</span>
        </Button>
      </div>
    </div>
  );
}
