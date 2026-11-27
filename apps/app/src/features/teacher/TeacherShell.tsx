// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { ListInitials } from '../../ui/GroupedList';
import { Icon, type IconName } from '../../ui/Icon';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { SchoolLogo } from '../../ui/Sidebar';
import { SchoolSwitcher } from '../../ui/SchoolSwitcher';
import { recordSignInOnce } from './signIn';
import { TeacherDataProvider, useTeacherData, type TeacherInjected } from './teacherData';

interface Tab {
  to: string;
  end?: boolean;
  icon: IconName;
  labelKey: 'nav.today' | 'nav.timetable' | 'nav.myClass' | 'nav.me';
}

export function teacherTabs(sid: string, classTeacher: boolean): Tab[] {
  const base = `/s/${sid}/me`;
  return [
    { to: base, end: true, icon: 'clock', labelKey: 'nav.today' },
    { to: `${base}/timetable`, icon: 'calendar', labelKey: 'nav.timetable' },
    ...(classTeacher ? [{ to: `${base}/class`, icon: 'school', labelKey: 'nav.myClass' } satisfies Tab] : []),
    { to: `${base}/profile`, icon: 'person', labelKey: 'nav.me' },
  ];
}

export interface TeacherShellProps extends TeacherInjected {
  /** Tests render a page directly; the router renders the matched child route. */
  children?: ReactNode;
}

export function TeacherShell({ children, ...injected }: TeacherShellProps) {
  return (
    <TeacherDataProvider injected={injected}>
      <ShellFrame>{children ?? <Outlet />}</ShellFrame>
    </TeacherDataProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['teacher', 'common', 'shell']);
  const { lang, setLang } = useLang();
  const { school } = useSchool();
  const { sid, tid, base, classes } = useTeacherData();
  const isPhone = useMediaQuery(PHONE_QUERY);

  useEffect(() => {
    if (tid) recordSignInOnce();
  }, [tid]);

  const tabs = teacherTabs(sid, classes.data.length > 0);
  const name = pickName(school, lang);
  const target = lang === 'en' ? 'si' : 'en';
  const fullName = base ? (lang === 'si' && base.nameSi) || base.name : '';
  const language = (
    <Button
      onClick={() => setLang(target)}
      aria-label={`${t('shell:sidebar.language')}: ${t(`common:languages.${target}`)}`}
      className="min-w-11 shrink-0 px-2.5"
    >
      {t(`shell:sidebar.langShort.${target}`)}
    </Button>
  );

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-ground text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2.5 pl-4 pr-2.5 md:h-16 md:gap-3.5 md:px-6">
          <SchoolLogo school={school} name={name} decorative />
          <strong className={cx('min-w-0 truncate text-sm md:mr-4 md:flex-none md:text-[15px]', isPhone && 'flex-1')}>{name}</strong>
          {!isPhone && (
            <nav aria-label={t('teacher:nav.label')} className="flex h-16 flex-1 items-stretch">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cx(
                      'inline-flex items-center border-b-[3px] px-3.5 text-sm font-semibold no-underline',
                      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                      isActive ? 'border-brand text-brand' : 'border-transparent text-ink-soft hover:text-ink',
                    )
                  }
                >
                  {t(`teacher:${tab.labelKey}`)}
                </NavLink>
              ))}
            </nav>
          )}
          {language}
          {!isPhone && fullName && <ListInitials name={fullName} />}
        </div>
      </header>

      <main className={cx('mx-auto w-full max-w-[1280px] flex-1', isPhone ? 'px-3.5 pb-24 pt-3.5' : 'px-8 pb-10 pt-6')}>
        <SchoolSwitcher current={sid} className="mb-3 w-full md:w-80" />
        {children}
      </main>

      {isPhone && (
        <nav
          aria-label={t('teacher:nav.label')}
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  'flex h-16 flex-col items-center justify-center gap-[3px] text-[11px] font-semibold no-underline',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  isActive ? 'text-brand' : 'text-ink-muted',
                )
              }
            >
              <Icon name={tab.icon} size={22} strokeWidth={2} />
              {t(`teacher:${tab.labelKey}`)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
