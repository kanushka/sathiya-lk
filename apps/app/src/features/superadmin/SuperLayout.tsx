// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { SchoolReport } from '@sathiya/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useMaybeLang } from '../../app/LangProvider';
import { homePath, readLastSchool } from '../../app/schoolHome';
import type { CollectionState } from '../../lib/firestore';
import { cx } from '../../ui/cx';
import { BrandMark } from '../auth/AuthChrome';
import { superNav } from './nav';
import { useOpenReports } from './reports';
import { SuperPhoneBar } from './SuperPhoneBar';


const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'block rounded-lg px-3 py-2 text-sm font-medium text-[#C9D1E3] hover:bg-white/5',
    isActive && 'bg-white/10 font-bold text-white',
  );

export function SuperLayout({ children, openReports }: { children: ReactNode; openReports?: CollectionState<SchoolReport> }) {
  const { t } = useTranslation(['superadmin', 'shell', 'common']);
  const { claims, signOut } = useAuth();
  const langCtl = useMaybeLang();
  const target = langCtl?.lang === 'en' ? 'si' : 'en';
  const reports = useOpenReports(openReports);
  const openCount = reports.loading || reports.error ? 0 : reports.data.filter((r) => r.status === 'open').length;
  const schoolHome = homePath(claims, readLastSchool());
  const isMember = schoolHome.startsWith('/s/');
  const langLabel = t(`common:languages.${target}`);
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink md:flex-row">
      <SuperPhoneBar
        openCount={openCount}
        schoolHome={isMember ? schoolHome : undefined}
        language={
          langCtl ? { label: langLabel, ariaLabel: `${t('shell:sidebar.language')}: ${langLabel}`, onToggle: () => langCtl.setLang(target) } : undefined
        }
        onSignOut={() => void signOut()}
      />
      <aside className="hidden w-[230px] shrink-0 bg-navy px-3.5 py-5 md:block">
        <div className="flex items-center gap-2.5 px-2 pb-[18px]">
          <BrandMark size={28} />
          <div>
            <strong className="block text-white">{t('brand')}</strong>
            <span className="text-xs font-bold text-saffron">{t('role')}</span>
          </div>
        </div>
        <nav aria-label={t('nav.label')}>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {superNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={linkClass}>
                  {t(item.labelKey)}
                  {item.to === '/super/reports' && openCount > 0 && (
                    <span className="ml-2 rounded-full bg-saffron px-2 py-0.5 text-xs font-bold text-navy">{openCount}</span>
                  )}
                </NavLink>
              </li>
            ))}
            {isMember && (
              <li className="mt-4 border-t border-white/10 pt-3">
                <NavLink to={schoolHome} className={linkClass}>
                  {t('nav.schoolAdmin')}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="mt-6 flex flex-col gap-0.5 border-t border-white/10 pt-3">
          {langCtl && (
            <button
              type="button"
              onClick={() => langCtl.setLang(target)}
              aria-label={`${t('shell:sidebar.language')}: ${t(`common:languages.${target}`)}`}
              className={cx(linkClass({ isActive: false }), 'text-left')}
            >
              {t(`common:languages.${target}`)}
            </button>
          )}
          <button type="button" onClick={() => void signOut()} className={cx(linkClass({ isActive: false }), 'text-left')}>
            {t('shell:sidebar.signOut')}
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-4 md:px-9 md:py-7">{children}</main>
    </div>
  );
}
