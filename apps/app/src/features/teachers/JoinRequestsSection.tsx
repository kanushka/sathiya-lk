// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherDisplayName, type Lang, type Teacher } from '@sathiya/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { ListSection } from '../../ui/GroupedList';
import { useToast } from '../../ui/Toast';
import { accountActionError } from './accountErrors';
import * as api from './api';
import type { JoinRequestDoc } from './useJoinRequests';

const VISIBLE = 3;

export interface JoinRequestsProps {
  schoolId: string;
  requests: JoinRequestDoc[];
  teachers: Teacher[];
  readOnly: boolean;
  /** Phone layout: a grouped-list section of cards. */
  phone?: boolean;
}

export function JoinRequests({ schoolId, requests, teachers, readOnly, phone = false }: JoinRequestsProps) {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;
  const toast = useToast();
  const headingId = useId();
  const [busy, setBusy] = useState<{ uid: string; approve: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  if (requests.length === 0) return null;

  async function decide(r: JoinRequestDoc, approve: boolean) {
    setBusy({ uid: r.uid, approve });
    try {
      await api.decideJoinRequest(schoolId, r.uid, r.teacherId, r.createdAt, approve);
      toast.show(approve ? t('requests.approved', { name: r.name || r.email }) : t('requests.rejected'), 'success');
    } catch (err) {
      toast.show(accountActionError(err, t), 'error');
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...requests].sort((a, b) => a.createdAt - b.createdAt);
  const hidden = sorted.length - VISIBLE;
  const shown = expanded || hidden <= 0 ? sorted : sorted.slice(0, VISIBLE);

  const more = hidden > 0 && (
    <Button variant="link" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
      {expanded ? t('requests.showFewer') : t('requests.showAll', { count: sorted.length })}
    </Button>
  );

  if (phone) {
    return (
      <ListSection title={t('phone.requests')} count={requests.length} tone="warning" bare>
        <ul id={listId} className="m-0 flex list-none flex-col gap-2.5 p-0">
          {shown.map((r) => {
            const teacher = teachers.find((x) => x.id === r.teacherId);
            return (
              <li key={r.uid} className="rounded-[14px] border border-warning-line bg-warning-soft p-4 text-[13px] text-ink-soft">
                <p className="m-0 text-[15px] font-semibold text-ink">
                  {teacher ? teacherDisplayName(teacher, lang) : t('requests.unknownTeacher')}
                  <span className="font-mono text-xs font-semibold text-ink-soft"> · {r.staffId}</span>
                </p>
                <p className="m-0 mt-1 break-words text-ink">{r.email}</p>
                {r.name && <p className="m-0 mt-0.5 break-words">{t('requests.givenName', { name: r.name })}</p>}
                {!readOnly && (
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <Button size="lg" variant="primary" loading={busy?.uid === r.uid && busy.approve} disabled={busy !== null} onClick={() => void decide(r, true)}>
                      {t('requests.approve')}
                    </Button>
                    <Button size="lg" loading={busy?.uid === r.uid && !busy.approve} disabled={busy !== null} onClick={() => void decide(r, false)}>
                      {t('requests.reject')}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {more && <div className="pt-2">{more}</div>}
      </ListSection>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-warning-line bg-warning-soft/40 p-5">
      <h2 id={headingId} className="m-0 text-[17px] font-bold">
        {t('requests.title', { count: requests.length })}
      </h2>
      <p className="mb-0 mt-1 text-sm text-ink-soft">{t('requests.body')}</p>
      <ul id={listId} className="m-0 mt-3 list-none p-0">
        {shown.map((r) => {
          const teacher = teachers.find((x) => x.id === r.teacherId);
          return (
            <li key={r.uid} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft py-3 text-sm first:border-t-0">
              <div className="min-w-0 flex-1">
                <strong className="block break-words">{r.email}</strong>
                {r.name && <span className="block text-ink-muted">{t('requests.givenName', { name: r.name })}</span>}
                <span className="block text-ink-soft">
                  {t('requests.claims', { teacher: teacher ? teacherDisplayName(teacher, lang) : t('requests.unknownTeacher'), staffId: r.staffId })}
                </span>
              </div>
              {!readOnly && (
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" loading={busy?.uid === r.uid && busy.approve} disabled={busy !== null} onClick={() => void decide(r, true)}>
                    {t('requests.approve')}
                  </Button>
                  <Button size="sm" loading={busy?.uid === r.uid && !busy.approve} disabled={busy !== null} onClick={() => void decide(r, false)}>
                    {t('requests.reject')}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {more && <div className="border-t border-line-soft pt-3">{more}</div>}
    </section>
  );
}
