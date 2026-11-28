// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { cleanPhone, isSchoolAdmin, teacherDisplayName, type DayIndex, type TeacherSnapshot } from '@sathiya/core';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { call, toApiError } from '../../lib/callable';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Field, inputClass } from '../../ui/Field';
import { initialsOf, ListInitials, ListSection } from '../../ui/GroupedList';
import { Icon, type IconName } from '../../ui/Icon';
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { useToast } from '../../ui/Toast';
import { gradeRange } from '../teachers/TeachersPhoneList';
import { cellText, slotsOf, weekdays } from './cells';
import { printClassPath, printTimetablePath } from './parts';
import type { OverlaySnapshot } from './reliefOverlay';
import { useOwnTeacher, useTeacherData } from './teacherData';

export interface DayLoad {
  day: DayIndex;
  /** One entry per period of the day: a lesson of hers, relief she covers today, or free. */
  slots: Array<'lesson' | 'relief' | 'free'>;
  lessons: number;
  relief: number;
}

export interface MeStats {
  periodsAWeek: number;
  periodSlots: number;
  free: number;
  classes: string[];
  days: DayLoad[];
}

/** Everything Me shows about the week, from the published timetable and today's relief. Nothing extra is read. */
export function meStats(base: TeacherSnapshot, today: OverlaySnapshot | null, todayDay: DayIndex | null): MeStats {
  const days = weekdays.map((day): DayLoad => {
    const periods = slotsOf(base.rows[day] ?? []).filter((s) => s.kind === 'period');
    const busy = new Set(base.cells.filter((c) => c.day === day).map((c) => c.period));
    const covering = new Set(day === todayDay && today ? today.cells.filter((c) => c.day === day && c.relief).map((c) => c.period) : []);
    const slots = periods.map((p) => (busy.has(p.n) ? 'lesson' : covering.has(p.n) ? 'relief' : 'free') as DayLoad['slots'][number]);
    return { day, slots, lessons: slots.filter((s) => s === 'lesson').length, relief: slots.filter((s) => s === 'relief').length };
  });
  const periodSlots = days.reduce((n, d) => n + d.slots.length, 0);
  const busySlots = days.reduce((n, d) => n + d.lessons, 0);
  const classes = [...new Set(base.cells.flatMap((c) => c.title.split('+').map((s) => s.trim())).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  return { periodsAWeek: base.cells.length, periodSlots, free: Math.max(0, periodSlots - busySlots), classes, days };
}

function useReliefCount(sid: string): number | null {
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
  return count;
}

export function MePage() {
  const { t } = useTranslation('teacher');
  const { lang } = useLang();
  const { user, claims, signOut } = useAuth();
  const { sid, base, classes, today, snapFor } = useTeacherData();
  const teacher = useOwnTeacher();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const reliefCount = useReliefCount(sid);

  if (teacher.loading) return <LoadingState />;
  const rec = teacher.data;
  const name = rec ? teacherDisplayName(rec, lang) : base ? (lang === 'si' && base.nameSi) || base.name : '';
  const me: Profile = {
    sid,
    name,
    staffId: rec?.staffId ?? base?.staffId ?? '',
    email: rec?.email || user?.email || '',
    phone: rec?.phone ?? '',
    summary: [
      [...new Set((base?.cells ?? []).map((c) => cellText(c, lang).sub).filter(Boolean))].join(', '),
      rec?.grades?.length ? t('me.grades', { grades: gradeRange(rec.grades) }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    classTeacherOf: [...classes.data].map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    admin: isSchoolAdmin(claims, sid),
    signOut: () => void signOut(),
    stats: base ? meStats(base, today.day === null ? null : snapFor(today.date), today.day) : null,
    reliefCount,
    todayDay: today.day,
  };
  return isPhone ? <PhoneMe me={me} /> : <DesktopMe me={me} />;
}

interface Profile {
  sid: string;
  name: string;
  staffId: string;
  email: string;
  phone: string;
  summary: string;
  classTeacherOf: Array<{ id: string; name: string }>;
  admin: boolean;
  signOut: () => void;
  /** null until the school publishes a timetable for this teacher. */
  stats: MeStats | null;
  reliefCount: number | null;
  todayDay: DayIndex | null;
}

/**
 * The School admin link, tinted brand so an admin who also teaches finds the way back.
 * The tint is marked important: the secondary variant's own border, background and text would win otherwise.
 */
function AdminLink({ sid, className }: { sid: string; className?: string }) {
  const { t } = useTranslation('teacher');
  return (
    <LinkButton to={`/s/${sid}/admin`} size="lg" className={cx('border-brand/30! bg-brand/5! text-brand! hover:bg-brand/10!', className)}>
      <Icon name="dashboard" size={18} />
      {t('adminLink')}
    </LinkButton>
  );
}

// ---------- Phone: the approved board ----------

function PhoneMe({ me }: { me: Profile }) {
  const { t } = useTranslation('teacher');
  const notPublished = t('me.notPublished');
  return (
    <div className="flex flex-col gap-3 [&>section]:mb-0">
      <div className="flex items-center gap-3">
        <ListInitials name={me.name} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-xl font-bold">{me.name}</h1>
          {me.summary && <span className="block truncate text-[13px] text-ink-muted">{me.summary}</span>}
        </div>
      </div>

      <ListSection title={t('me.details')}>
        <ReadOnlyRow label={t('me.name')} value={me.name} />
        <ReadOnlyRow label={t('me.staffId')} value={<span className="font-mono text-[13px]">{me.staffId}</span>} />
        <ReadOnlyRow label={t('me.email')} value={<span className="break-all text-[13px]">{me.email || '—'}</span>} />
      </ListSection>
      <p className="m-0 -mt-1.5 text-xs text-ink-muted">{t('me.askAdmin')}</p>

      <PhoneCard key={me.phone} sid={me.sid} saved={me.phone} />

      <ListSection title={t('me.thisYear')}>
        <ReadOnlyRow label={t('me.reliefCovered')} value={me.reliefCount ?? '—'} />
        <ReadOnlyRow label={t('me.periodsAWeek')} value={me.stats ? me.stats.periodsAWeek : <span className="font-normal text-ink-muted">{notPublished}</span>} />
      </ListSection>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton to={printTimetablePath(me.sid)} size="lg">
          {t('me.printTimetable')}
        </LinkButton>
        <Button size="lg" onClick={me.signOut}>
          {t('signOut')}
        </Button>
      </div>
      {me.admin && <AdminLink sid={me.sid} />}
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

// ---------- Tablet and desktop: two columns from 1024 px, one column below ----------

function DesktopMe({ me }: { me: Profile }) {
  const { t } = useTranslation('teacher');
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <ProfileCard me={me} />
      <div className="flex min-w-0 flex-col gap-4">
        <h2 className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted">{t('me.thisYear')}</h2>
        <section aria-label={t('me.thisYear')} className="grid gap-3 sm:grid-cols-3">
          <Tile label={t('me.periodsAWeek')} value={me.stats?.periodsAWeek} sub={me.stats && t('me.freeOf', { free: me.stats.free, total: me.stats.periodSlots })} />
          <Tile label={t('me.reliefCovered')} value={me.reliefCount ?? undefined} sub={t('me.thisSchoolYear')} dash />
          <Tile label={t('me.classesTaught')} value={me.stats?.classes.length} sub={me.stats?.classes.join(', ')} />
        </section>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <DetailsCard me={me} />
          {me.stats && <DaysCard days={me.stats.days} todayDay={me.todayDay} />}
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ me }: { me: Profile }) {
  const { t } = useTranslation('teacher');
  const action = (to: string, icon: IconName, label: string) => (
    <LinkButton to={to} size="lg" className="justify-start">
      <Icon name={icon} size={18} />
      {label}
    </LinkButton>
  );
  return (
    <section aria-label={t('me.profile')} className="flex flex-col gap-[18px] rounded-[14px] border border-line bg-white p-6">
      <span aria-hidden="true" className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-[22px] font-extrabold text-brand">
        {initialsOf(me.name)}
      </span>
      <div>
        <h1 className="m-0 text-[22px] font-bold leading-tight">{me.name}</h1>
        {me.summary && <span className="mt-1 block text-[13px] text-ink-muted">{me.summary}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {me.classTeacherOf.length > 0 && (
          <Badge tone="brand" className="h-6">
            {t('me.classTeacherOf', { classes: me.classTeacherOf.map((c) => c.name).join(', ') })}
          </Badge>
        )}
        {me.staffId && <Badge className="h-6 font-mono">{me.staffId}</Badge>}
      </div>
      <hr className="m-0 border-0 border-t border-line-soft" />
      <div className="flex flex-col gap-2">
        {action(printTimetablePath(me.sid), 'print', t('me.printMyTimetable'))}
        {me.classTeacherOf.map((c) => (
          <span key={c.id} className="contents">
            {action(printClassPath(me.sid, c.id), 'print', t('myClass.print', { name: c.name }))}
          </span>
        ))}
        {me.admin && <AdminLink sid={me.sid} className="justify-start" />}
      </div>
      <hr className="m-0 border-0 border-t border-line-soft" />
      <Button variant="ghost" size="lg" onClick={me.signOut} className="justify-start">
        <Icon name="logout" size={18} />
        {t('signOut')}
      </Button>
    </section>
  );
}

function Tile({ label, value, sub, dash }: { label: string; value: number | undefined; sub?: string | null | undefined; dash?: boolean }) {
  const { t } = useTranslation('teacher');
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[14px] border border-line bg-white px-[18px] py-4">
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      {value === undefined ? (
        <span className="py-1.5 text-[15px] font-semibold text-ink-muted">{dash ? '—' : t('me.notPublished')}</span>
      ) : (
        <b className="text-[30px] font-extrabold leading-tight">{value}</b>
      )}
      {sub && value !== undefined && <span className="truncate text-[13px] text-ink-muted">{sub}</span>}
    </div>
  );
}

function DetailsCard({ me }: { me: Profile }) {
  const { t } = useTranslation('teacher');
  const row = (label: string, value: ReactNode) => (
    <div className="flex flex-col gap-1 border-b border-line-soft px-[18px] py-3.5">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <b className="break-all text-[15px] font-semibold">{value}</b>
    </div>
  );
  return (
    <section aria-label={t('me.details')} className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line-soft px-[18px] py-3.5">
        <h2 className="m-0 text-[15px] font-bold">{t('me.details')}</h2>
        <span className="text-xs text-ink-muted">{t('me.askAdmin')}</span>
      </div>
      {row(t('me.name'), me.name)}
      {row(t('me.staffId'), <span className="font-mono text-sm">{me.staffId}</span>)}
      {row(t('me.email'), <span className="text-sm">{me.email || '—'}</span>)}
      <div className="bg-surface px-[18px] py-3.5">
        <PhoneForm key={me.phone} sid={me.sid} saved={me.phone} hint={t('me.phoneEditable')} />
      </div>
    </section>
  );
}

function DaysCard({ days, todayDay }: { days: DayLoad[]; todayDay: DayIndex | null }) {
  const { t } = useTranslation(['teacher', 'common']);
  const most = Math.max(1, ...days.map((d) => d.slots.length));
  const legend = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cx('h-3.5 w-3.5 rounded', cls)} />
      {label}
    </span>
  );
  return (
    <section aria-label={t('me.periodsEachDay')} className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white px-[18px] pb-[18px] pt-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-[15px] font-bold">{t('me.periodsEachDay')}</h2>
        <span className="text-xs text-ink-muted">{t('me.ofN', { n: most })}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {days.map((d) => (
          <li
            key={d.day}
            data-testid={`day-load-${d.day}`}
            aria-label={t('me.dayLoad', { day: t(`common:days.long.${d.day}`), count: d.lessons }) + (d.relief ? ` ${t('me.dayRelief', { count: d.relief })}` : '')}
            className="grid grid-cols-[44px_minmax(0,1fr)_48px] items-center gap-3 text-[13px]"
          >
            <b className={cx(d.day === todayDay && 'text-brand')}>{t(`common:days.short.${d.day}`)}</b>
            <span aria-hidden="true" className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${most}, minmax(0, 1fr))` }}>
              {d.slots.map((s, i) => (
                <span key={i} className={cx('h-3.5 rounded', s === 'lesson' ? 'bg-brand' : s === 'relief' ? 'bg-brand/35' : 'bg-surface-3')} />
              ))}
            </span>
            <span aria-hidden="true" className="text-right">
              {d.relief ? `${d.lessons} + ${d.relief}` : d.lessons}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3.5 text-xs text-ink-muted">
        {legend('bg-brand', t('me.legendLesson'))}
        {legend('bg-brand/35', t('me.legendRelief'))}
        {legend('bg-surface-3', t('me.legendFree'))}
      </div>
    </section>
  );
}

// ---------- Phone number: saves at once through setMyPhone ----------

function usePhoneSave(sid: string, saved: string) {
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
  const change = (v: string) => {
    setValue(v);
    setError(null);
  };
  return { value, change, error, busy, unchanged, save };
}

function PhoneForm({ sid, saved, hint }: { sid: string; saved: string; hint?: string }) {
  const { t } = useTranslation('teacher');
  const p = usePhoneSave(sid, saved);
  return (
    <form onSubmit={(e) => void p.save(e)} noValidate className="flex items-start gap-2">
      <Field label={t('me.phone')} hint={hint} error={p.error ?? undefined} className="min-w-0 flex-1">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          value={p.value}
          onChange={(e) => p.change(e.target.value)}
          className={cx(inputClass, 'h-11 text-[15px]')}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={p.busy} disabled={p.unchanged} className="mt-[26px]">
        {t('me.save')}
      </Button>
    </form>
  );
}

function PhoneCard({ sid, saved }: { sid: string; saved: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-3.5 py-3">
      <PhoneForm sid={sid} saved={saved} />
    </div>
  );
}
