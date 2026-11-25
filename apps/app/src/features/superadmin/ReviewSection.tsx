// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Member, type School } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import type { CollectionState } from '../../lib/firestore';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Field, textareaClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import { formatDate } from './format';
import { possibleDuplicates, REASON_MAX, type ReviewFn } from './review';
import { StatusPill } from './StatusControl';

export function MoeBadge({ matched }: { matched: boolean }) {
  const { t } = useTranslation('superadmin');
  return <Badge tone={matched ? 'success' : 'warning'}>{t(matched ? 'review.moeMatched' : 'review.moeMissing')}</Badge>;
}

function DuplicateList({ title, schools }: { title: string; schools: School[] }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  return (
    <div className="min-w-0 flex-[1_1_260px]">
      <h4 className="m-0 mb-1 text-[13px] font-bold text-ink-soft">{title}</h4>
      {schools.length === 0 ? (
        <p className="m-0 py-2 text-sm text-ink-muted">{t('review.none')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {schools.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0">
              <div className="min-w-0">
                <Link to={`/super/schools/${s.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                  {pickName(s, lang)}
                </Link>
                <small className="block text-xs text-ink-muted">
                  {[s.censusNo && t('schools.censusShort', { no: s.censusNo }), s.city, s.district].filter(Boolean).join(' · ')}
                </small>
              </div>
              <StatusPill status={s.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RejectModal({ name, onClose, onReject }: { name: string; onClose: () => void; onReject: (reason: string) => Promise<boolean> }) {
  const { t } = useTranslation('superadmin');
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const trimmed = reason.trim();
  const error = !tried ? undefined : !trimmed ? t('review.reasonRequired') : trimmed.length > REASON_MAX ? t('review.reasonTooLong') : undefined;

  async function submit() {
    setTried(true);
    if (!trimmed || trimmed.length > REASON_MAX) return;
    setBusy(true);
    if (!(await onReject(trimmed))) setBusy(false);
  }

  return (
    <Modal
      open
      width={520}
      title={t('review.rejectTitle', { name })}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t('buttons.cancel', { ns: 'common' })}
          </Button>
          <Button variant="dangerSolid" loading={busy} onClick={() => void submit()}>
            {t('review.confirmReject')}
          </Button>
        </>
      }
    >
      <p className="mb-4 mt-0 text-sm leading-normal text-ink-soft">{t('review.rejectBody')}</p>
      <Field label={t('review.reason')} required hint={t('review.reasonHint')} error={error}>
        <textarea
          className={textareaClass}
          aria-required="true"
          maxLength={REASON_MAX}
          placeholder={t('review.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

export interface ReviewSectionProps {
  school: School;
  schools: CollectionState<School>;
  members: CollectionState<Member>;
  review: ReviewFn;
}

export function ReviewSection({ school, schools, members, review }: ReviewSectionProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const name = pickName(school, lang);
  const pending = school.status === 'pending';
  const registrant = members.data.find((m) => m.role === 'admin');
  const dups = useMemo(() => possibleDuplicates(school, schools.data), [school, schools.data]);
  const decidedAt = school.review?.decidedAt;

  async function approve() {
    setApproving(true);
    try {
      await review({ schoolId: school.id, approve: true });
      toast.show(t('review.toastApproved', { name }), 'success');
    } catch (err) {
      toast.show(t('review.failed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setApproving(false);
    }
  }

  async function reject(reason: string): Promise<boolean> {
    try {
      await review({ schoolId: school.id, approve: false, reason });
      toast.show(t('review.toastRejected'), 'success');
      setRejecting(false);
      return true;
    } catch (err) {
      toast.show(t('review.failed', { message: errorMessage(t, err) }), 'error');
      return false;
    }
  }

  return (
    <section aria-labelledby="review-title" className="mb-5 rounded-[14px] border border-line bg-white px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="review-title" className="m-0 text-xl font-bold">
            {t('review.title')}
          </h2>
          <StatusPill status={school.status} />
        </div>
        {pending ? (
          <div className="flex flex-wrap gap-2.5">
            <Button variant="danger" disabled={approving} onClick={() => setRejecting(true)}>
              {t('review.reject')}
            </Button>
            <Button variant="primary" loading={approving} onClick={() => void approve()}>
              {t('review.approve')}
            </Button>
          </div>
        ) : (
          decidedAt && (
            <p className="m-0 text-[13px] text-ink-soft">
              {t(school.status === 'rejected' ? 'review.rejected' : 'review.approved', { date: formatDate(decidedAt, lang) })}
            </p>
          )
        )}
      </div>

      {school.status === 'rejected' && school.review?.reason && (
        <div className="mt-4">
          <p className="mb-1.5 mt-0 text-[13px] font-semibold text-ink-muted">{t('review.reasonSent')}</p>
          <p className="m-0 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink-soft">{school.review.reason}</p>
        </div>
      )}

      {pending && (
        <>
          <dl className="m-0 mt-4 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <div>
              <dt className="text-[13px] text-ink-muted">{t('review.registrant')}</dt>
              <dd className="m-0 mt-0.5">
                {registrant ? (
                  <>
                    {registrant.name ?? registrant.email ?? '—'}
                    {registrant.name && registrant.email && <span className="block text-[13px] text-ink-soft">{registrant.email}</span>}
                  </>
                ) : members.loading ? (
                  '…'
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-muted">{t('review.moe')}</dt>
              <dd className="m-0 mt-0.5">
                <MoeBadge matched={!!school.review?.moeMatched} />
              </dd>
            </div>
          </dl>

          <section aria-labelledby="dups-title" className="mt-5 rounded-xl border border-line p-4">
            <h3 id="dups-title" className="m-0 text-[15px] font-bold">
              {t('review.duplicates')}
            </h3>
            <p className="mb-3 mt-1 text-[13px] text-ink-soft">{t('review.duplicatesHint')}</p>
            {schools.loading ? (
              <p className="m-0 text-sm text-ink-muted">…</p>
            ) : (
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <DuplicateList title={t('review.similar')} schools={dups.similar} />
                <DuplicateList title={t('review.sameArea', { district: school.district })} schools={dups.sameArea} />
              </div>
            )}
            <p className="mb-0 mt-3 text-xs text-ink-muted">{t('review.moeNote')}</p>
          </section>

          <p className="mb-0 mt-4 border-t border-line-soft pt-3.5 text-[13px] text-ink-muted">{t('review.footer')}</p>
        </>
      )}

      {rejecting && <RejectModal name={name} onClose={() => setRejecting(false)} onReject={reject} />}
    </section>
  );
}
