// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherDisplayName, type Lang, type Teacher } from '@sathiya/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
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
}

export function JoinRequests({ schoolId, requests, teachers, readOnly }: JoinRequestsProps) {
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
                <strong className="block break-all">{r.email}</strong>
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
      {hidden > 0 && (
        <div className="border-t border-line-soft pt-3">
          <Button variant="link" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('requests.showFewer') : t('requests.showAll', { count: sorted.length })}
          </Button>
        </div>
      )}
    </section>
  );
}
