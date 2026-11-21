import { paths, pickName, type TeacherSnapshot } from '@sathiya/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { useDoc, type DocState } from '../../lib/firestore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { cx } from '../../ui/cx';
import { ChangePasswordModal } from './ChangePasswordModal';
import type { ChangePasswordFn } from './firebasePassword';
import { useNow, type NowFn } from './useNow';

export interface TeacherViewProps {
  now?: NowFn;
  snapshot?: DocState<TeacherSnapshot>;
  changePassword?: ChangePasswordFn;
}

interface FrameProps extends TeacherViewProps {
  view: 'today' | 'week';
  children: (snap: TeacherSnapshot, now: Date) => ReactNode;
}

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}

export function TeacherFrame({ view, now: nowFn, snapshot, changePassword, children }: FrameProps) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang, setLang } = useLang();
  const { claims, signOut } = useAuth();
  const { school } = useSchool();
  const now = useNow(nowFn);
  const [pwOpen, setPwOpen] = useState(false);

  const yearId = school.activeYearId;
  const tid = claims.tid;
  const path = !snapshot && yearId && tid ? paths.publishedTeacher(school.id, yearId, tid) : null;
  const live = useDoc<TeacherSnapshot>(path);
  const state = snapshot ?? live;
  const snap = state.data;

  const schoolName = pickName(school, lang);
  const dateLine = new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const firstName = snap?.name;

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
        'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-bold',
        active ? 'bg-white text-ink' : 'text-on-brand/90',
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col overflow-x-hidden bg-[#F6F6F4] text-ink">
      <header className="bg-brand px-[18px] pb-14 pt-5 text-on-brand">
        <div className="flex items-center gap-2.5">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt="" className="h-[34px] w-[34px] rounded-lg bg-white object-contain" />
          ) : (
            <span aria-hidden="true" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-white text-xs font-extrabold text-brand">
              {school.staffPrefix}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm">{schoolName}</strong>
            {snap && (
              <span className="block truncate text-xs opacity-80">
                {snap.name} · {snap.staffId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'si' : 'en')}
            aria-label={t('teacher:language')}
            className="h-8 rounded-lg border border-on-brand/40 bg-transparent px-2.5 text-[13px] font-semibold"
          >
            {lang === 'en' ? 'සිං' : 'EN'}
          </button>
        </div>
        <p className="mt-4 text-[22px] font-extrabold leading-tight">
          {t(`teacher:greeting.${greetingKey(now.getHours())}`)}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <p className="mt-0.5 text-sm opacity-85">{dateLine}</p>
        {snap && (
          <nav aria-label={t('teacher:views.label')} className="mt-4 flex gap-1 rounded-[10px] bg-black/15 p-1">
            {tab('/me', t('teacher:views.today'), view === 'today')}
            {tab('/me/week', t('teacher:views.week'), view === 'week')}
          </nav>
        )}
      </header>

      <main className="-mt-8 flex-1 px-3.5 pb-6">{body}</main>

      <footer className="flex items-center justify-center gap-3 px-3.5 pb-8">
        <Button variant="ghost" size="sm" onClick={() => setPwOpen(true)}>
          {t('teacher:changePassword')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          {t('teacher:signOut')}
        </Button>
      </footer>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} changePassword={changePassword} />
    </div>
  );
}
