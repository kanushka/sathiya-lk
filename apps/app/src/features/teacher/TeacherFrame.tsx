// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { colomboToday, isSchoolAdmin, paths, pickName, teacherIdOf, type ReliefDay, type TeacherSnapshot } from '@sathiya/core';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useDoc, type DocState } from '../../lib/firestore';
import { Button, buttonClass } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { cx } from '../../ui/cx';
import { SchoolSwitcher } from '../../ui/SchoolSwitcher';
import { recordSignInOnce } from './signIn';
import { colomboNow, greetingKey } from './colomboNow';
import { overlayRelief, type OverlaySnapshot } from './reliefOverlay';
import { useNow, type NowFn } from './useNow';

export interface TeacherViewProps {
  now?: NowFn;
  snapshot?: DocState<TeacherSnapshot>;
  reliefDay?: DocState<ReliefDay>;
}

interface FrameProps extends TeacherViewProps {
  view: 'today' | 'week';
  children: (snap: OverlaySnapshot, now: Date) => ReactNode;
}

export function TeacherFrame({ view, now: nowFn, snapshot, reliefDay, children }: FrameProps) {
  const { t } = useTranslation(['teacher', 'common', 'shell']);
  const { lang, setLang } = useLang();
  const { claims, signOut } = useAuth();
  const { school } = useSchool();
  const instant = useNow(nowFn);
  const now = colomboNow(instant);

  const yearId = school.activeYearId;
  const sid = school.id;
  const tid = teacherIdOf(claims, sid);
  useEffect(() => {
    if (tid) recordSignInOnce();
  }, [tid]);
  const path = !snapshot && yearId && tid ? paths.publishedTeacher(school.id, yearId, tid) : null;
  const live = useDoc<TeacherSnapshot>(path);
  const state = snapshot ?? live;
  const today = colomboToday(instant);
  const reliefPath = !reliefDay && today.day !== null && yearId ? paths.reliefDay(sid, yearId, today.date) : null;
  const liveRelief = useDoc<ReliefDay>(reliefPath);
  const relief = (reliefDay ?? liveRelief).data ?? null;
  const base = state.data;
  const snap = useMemo(() => base && overlayRelief(base, relief, base.teacherId, lang), [base, relief, lang]);

  const target = lang === 'en' ? 'si' : 'en';
  const schoolName = pickName(school, lang);
  const dateLine = `${t(`common:weekdays.${now.getDay()}`)} ${now.getDate()} ${t(`common:months.${now.getMonth()}`)}`;
  const fullName = snap && (lang === 'si' && snap.nameSi ? snap.nameSi : snap.name);

  let body: ReactNode;
  if (state.loading) body = <LoadingState />;
  else if (state.error) body = <EmptyState title={t('teacher:loadError')} />;
  else if (!snap) body = <EmptyState icon="calendar" title={t('teacher:notPublished.title')} body={t('teacher:notPublished.body')} />;
  else body = children(snap, now);

  const tab = (to: string, label: string, active: boolean) => (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        active ? 'bg-white text-ink' : 'text-on-brand opacity-90',
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col overflow-x-hidden bg-[#F6F6F4] text-ink">
      <header className="bg-brand px-[18px] pb-14 pt-5 text-on-brand">
        <div className="flex items-center gap-2.5">
          {school.logoUrl && (
            <img data-testid="school-logo" src={school.logoUrl} alt="" className="h-[34px] w-[34px] rounded-lg bg-white object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm">{schoolName}</strong>
            {snap && (
              <span className="block truncate text-xs opacity-80">
                {fullName} · {snap.staffId}
              </span>
            )}
          </div>
          <Button
            variant="onBrand"
            size="sm"
            onClick={() => setLang(target)}
            aria-label={`${t('shell:sidebar.language')}: ${t(`common:languages.${target}`)}`}
          >
            {t(`shell:sidebar.langShort.${target}`)}
          </Button>
        </div>
        <SchoolSwitcher current={sid} className="mt-3 w-full" />
        <p className="mt-4 text-[22px] font-extrabold leading-tight">
          {t(`teacher:greeting.${greetingKey(now.getHours())}`)}
          {fullName ? `, ${fullName}` : ''}
        </p>
        <p className="mt-0.5 text-sm opacity-85">{dateLine}</p>
        {snap && (
          <nav aria-label={t('teacher:views.label')} className="mt-4 flex gap-1 rounded-[10px] bg-black/15 p-1">
            {tab(`/s/${sid}/me`, t('teacher:views.today'), view === 'today')}
            {tab(`/s/${sid}/me/week`, t('teacher:views.week'), view === 'week')}
          </nav>
        )}
      </header>

      <main className="-mt-8 flex-1 px-3.5 pb-6">{body}</main>

      <footer className="flex items-center justify-center gap-3 px-3.5 pb-8">
        {isSchoolAdmin(claims, sid) && (
          <Link to={`/s/${sid}/admin`} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
            {t('teacher:adminLink')}
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          {t('teacher:signOut')}
        </Button>
      </footer>
    </div>
  );
}
