// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { cleanPhone, isSchoolAdmin, teacherDisplayName } from '@sathiya/core';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { call, toApiError } from '../../lib/callable';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { ListInitials, ListSection } from '../../ui/GroupedList';
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { useToast } from '../../ui/Toast';
import { cx } from '../../ui/cx';
import { gradeRange } from '../teachers/TeachersPhoneList';
import { cellText } from './cells';
import { printTimetablePath } from './parts';
import { useOwnTeacher, useTeacherData } from './teacherData';

export function MePage() {
  const { t } = useTranslation('teacher');
  const { lang } = useLang();
  const { user, claims, signOut } = useAuth();
  const { sid, base } = useTeacherData();
  const teacher = useOwnTeacher();

  if (teacher.loading) return <LoadingState />;
  const rec = teacher.data;
  const name = rec ? teacherDisplayName(rec, lang) : base ? (lang === 'si' && base.nameSi) || base.name : '';
  const staffId = rec?.staffId ?? base?.staffId ?? '';
  const email = rec?.email || user?.email || '';
  const subjects = [...new Set((base?.cells ?? []).map((c) => cellText(c, lang).sub).filter(Boolean))];
  const grades = rec?.grades?.length ? t('me.grades', { grades: gradeRange(rec.grades) }) : null;
  const periodsAWeek = base?.cells.length;

  return (
    <div className="flex max-w-[560px] flex-col gap-3 [&>section]:mb-0">
      <div className="flex items-center gap-3">
        <ListInitials name={name} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-xl font-bold">{name}</h1>
          {(subjects.length > 0 || grades) && <span className="block truncate text-[13px] text-ink-muted">{[subjects.join(', '), grades].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>

      <ListSection title={t('me.details')}>
        <ReadOnlyRow label={t('me.name')} value={name} />
        <ReadOnlyRow label={t('me.staffId')} value={<span className="font-mono text-[13px]">{staffId}</span>} />
        <ReadOnlyRow label={t('me.email')} value={<span className="break-all text-[13px]">{email || '—'}</span>} />
      </ListSection>
      <p className="m-0 -mt-1.5 text-xs text-ink-muted">{t('me.askAdmin')}</p>

      <PhoneCard key={rec?.phone ?? ''} sid={sid} saved={rec?.phone ?? ''} />

      <ListSection title={t('me.thisYear')}>
        <ReliefCountRow sid={sid} />
        <ReadOnlyRow label={t('me.periodsAWeek')} value={periodsAWeek ?? '—'} />
      </ListSection>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton to={printTimetablePath(sid)} size="lg">
          {t('me.printTimetable')}
        </LinkButton>
        <Button size="lg" onClick={() => void signOut()}>
          {t('signOut')}
        </Button>
      </div>
      {isSchoolAdmin(claims, sid) && (
        <LinkButton to={`/s/${sid}/admin`} variant="ghost" size="lg">
          {t('adminLink')}
        </LinkButton>
      )}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-line-soft px-3.5 py-[11px] text-sm last:border-b-0">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <b className="min-w-0 text-right font-semibold">{value}</b>
    </li>
  );
}

function ReliefCountRow({ sid }: { sid: string }) {
  const { t } = useTranslation('teacher');
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    call('myReliefCount', { schoolId: sid }).then(
      (r) => live && setCount(r.count),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [sid]);
  return <ReadOnlyRow label={t('me.reliefCovered')} value={count ?? '—'} />;
}

function PhoneCard({ sid, saved }: { sid: string; saved: string }) {
  const { t } = useTranslation('teacher');
  const toast = useToast();
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only a valid value that matches the saved phone is unchanged. An invalid one keeps Save on, so the error can show.
  const cleaned = cleanPhone(value);
  const unchanged = cleaned !== undefined && (cleaned ?? '') === saved;

  async function save(e: FormEvent) {
    e.preventDefault();
    const phone = cleanPhone(value);
    if (phone === undefined) {
      setError(t('me.phoneInvalid'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await call('setMyPhone', { schoolId: sid, phone: phone ?? '' });
      setValue(res.phone ?? '');
      toast.show(res.phone ? t('me.phoneSaved') : t('me.phoneCleared'), 'success');
    } catch (err) {
      if (toApiError(err).code === 'invalid') setError(t('me.phoneInvalid'));
      else toast.show(t('me.phoneFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="rounded-[14px] border border-line bg-white px-3.5 py-3">
      <div className="flex items-end gap-2">
        <Field label={t('me.phone')} error={error ?? undefined} className="min-w-0 flex-1">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            className={cx(inputClass, 'h-11 text-[15px]')}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy} disabled={unchanged} className={cx(error && 'mb-[26px]')}>
          {t('me.save')}
        </Button>
      </div>
    </form>
  );
}
