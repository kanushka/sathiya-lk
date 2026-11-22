// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, type Lang, type School } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useMaybeLang } from '../app/LangProvider';
import { useSchool, useYear } from '../app/SchoolProvider';
import { SuperAdminLink } from '../features/superadmin/SuperAdminLink';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Select } from './Select';

export type NavGroup = 'main' | 'timetable' | 'setup' | 'school';

export interface NavItem {
  path: string;
  labelKey: string;
  icon: IconName;
  group: NavGroup;
}

export const navItems: readonly NavItem[] = [
  { path: '/admin', labelKey: 'nav.dashboard', icon: 'dashboard', group: 'main' },
  { path: '/admin/timetable/class', labelKey: 'nav.byClass', icon: 'classView', group: 'timetable' },
  { path: '/admin/timetable/teacher', labelKey: 'nav.byTeacher', icon: 'teacherView', group: 'timetable' },
  { path: '/admin/teachers', labelKey: 'nav.teachers', icon: 'teachers', group: 'setup' },
  { path: '/admin/subjects', labelKey: 'nav.subjects', icon: 'subjects', group: 'setup' },
  { path: '/admin/grades', labelKey: 'nav.grades', icon: 'grades', group: 'setup' },
  { path: '/admin/templates', labelKey: 'nav.templates', icon: 'templates', group: 'setup' },
  { path: '/admin/members', labelKey: 'nav.members', icon: 'members', group: 'school' },
  { path: '/admin/profile', labelKey: 'nav.profile', icon: 'profile', group: 'school' },
];

const groups: NavGroup[] = ['main', 'timetable', 'setup', 'school'];
const storageKey = 'sathiya.sidebar';
const yearLabelClass = 'mx-3 mb-1.5 mt-3.5 block text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(storageKey) === 'collapsed';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
  } catch {
    return;
  }
}

function SchoolLogo({ school, name, decorative }: { school: School; name: string; decorative: boolean }) {
  if (!school.logoUrl) return null;
  return (
    <img
      data-testid="school-logo"
      src={school.logoUrl}
      alt={decorative ? '' : name}
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-lg object-contain"
    />
  );
}

const linkBase =
  'flex items-center rounded-lg text-sm font-medium text-ink-soft no-underline hover:bg-[color-mix(in_srgb,var(--brand)_6%,white)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';
const linkActive = 'bg-[color-mix(in_srgb,var(--brand)_10%,white)] font-bold text-brand';

export interface SidebarProps {
  basePath?: string;
  readOnly?: boolean;
}

export function Sidebar({ basePath = '/admin', readOnly = false }: SidebarProps) {
  const { t, i18n } = useTranslation('shell');
  const lang: Lang = i18n.language === 'si' ? 'si' : 'en';
  const { claims, signOut } = useAuth();
  const { school } = useSchool();
  const { years, yearId, setYearId } = useYear();
  const langCtl = useMaybeLang();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const name = pickName(school, lang);
  const currentYear = years.find((y) => y.id === yearId);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  }

  const href = (path: string) => (path === '/admin' ? basePath : basePath + path.slice('/admin'.length));
  const toggleLabel = collapsed ? t('sidebar.expand') : t('sidebar.collapse');
  const yearSelectId = 'sidebar-year';

  return (
    <nav
      aria-label={t('nav.menu')}
      data-collapsed={collapsed}
      className={cx(
        'sticky top-0 flex h-screen shrink-0 flex-col overflow-y-auto border-r border-line bg-white py-[18px]',
        collapsed ? 'w-[72px] items-center gap-1 px-3' : 'w-[248px] px-3.5',
      )}
    >
      {collapsed ? (
        <>
          <SchoolLogo school={school} name={name} decorative={false} />
          <button
            type="button"
            onClick={toggle}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="mb-2 mt-2.5 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted hover:bg-surface"
          >
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </button>
          {currentYear && (
            <span className="mb-2 text-[11px] font-extrabold text-brand" title={t('sidebar.year')}>
              {currentYear.label}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 border-b border-line-soft pb-4 pl-2 pr-1 pt-1">
            <SchoolLogo school={school} name={name} decorative />
            <div className="min-w-0 flex-1">
              <strong className="block text-sm leading-tight text-ink">{name}</strong>
              <span className="text-xs text-ink-muted">{readOnly ? t('sidebar.readOnly') : t('sidebar.admin')}</span>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              title={toggleLabel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-muted hover:bg-surface"
            >
              <Icon name="chevronLeft" size={16} strokeWidth={2} />
            </button>
          </div>
          {years.length === 0 ? (
            <>
              <p className={yearLabelClass}>{t('sidebar.year')}</p>
              <p className="mx-3 text-sm text-ink-muted">{t('sidebar.noYears')}</p>
            </>
          ) : (
            <>
              <label htmlFor={yearSelectId} className={yearLabelClass}>
                {t('sidebar.year')}
              </label>
              <Select
                id={yearSelectId}
                value={yearId}
                onChange={setYearId}
                className="mx-1 w-[calc(100%-8px)]"
                options={years.map((y) => ({
                  value: y.id,
                  label: t('year.option', { label: y.label, status: t(`year.${y.status}`) }),
                }))}
              />
            </>
          )}
        </>
      )}

      <div className={cx('flex flex-col', collapsed ? 'items-center gap-1' : 'mt-3.5')}>
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} className={cx('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
              {group !== 'main' &&
                (collapsed ? (
                  <span aria-hidden="true" className="my-1.5 h-px w-7 bg-line-soft" />
                ) : (
                  <p className="mx-3 mb-1.5 mt-[18px] text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted">
                    {t(`nav.groups.${group}`)}
                  </p>
                ))}
              {items.map((item) => {
                const label = t(item.labelKey);
                return (
                  <NavLink
                    key={item.path}
                    to={href(item.path)}
                    end={item.path === '/admin'}
                    aria-label={collapsed ? label : undefined}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cx(
                        linkBase,
                        collapsed ? 'h-11 w-11 justify-center' : 'gap-2.5 px-3 py-[9px]',
                        isActive && linkActive,
                      )
                    }
                  >
                    <Icon name={item.icon} size={collapsed ? 20 : 18} />
                    {!collapsed && label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={cx('mt-auto flex flex-col gap-0.5 border-t border-line-soft pt-3', collapsed ? 'w-full items-center' : '')}>
        {claims.tid && !readOnly && (
          <NavLink
            to="/me"
            aria-label={collapsed ? t('nav.myTimetable') : undefined}
            title={collapsed ? t('nav.myTimetable') : undefined}
            className={cx(linkBase, collapsed ? 'h-11 w-11 justify-center' : 'gap-2.5 px-3 py-[9px]')}
          >
            <Icon name="calendar" size={collapsed ? 20 : 18} />
            {!collapsed && t('nav.myTimetable')}
          </NavLink>
        )}
        <SuperAdminLink
          compact={collapsed}
          className={cx(linkBase, collapsed ? 'h-11 w-11 justify-center' : 'gap-2.5 px-3 py-[9px]')}
        />
        {langCtl && (
          <button
            type="button"
            onClick={() => langCtl.setLang(langCtl.lang === 'en' ? 'si' : 'en')}
            aria-label={`${t('sidebar.language')}: ${t(`common:languages.${langCtl.lang === 'en' ? 'si' : 'en'}`)}`}
            title={t('sidebar.language')}
            className={cx(linkBase, collapsed ? 'h-11 w-11 justify-center text-xs font-bold' : 'gap-2.5 px-3 py-[9px]')}
          >
            {collapsed
              ? t(`sidebar.langShort.${langCtl.lang === 'en' ? 'si' : 'en'}`)
              : t(`common:languages.${langCtl.lang === 'en' ? 'si' : 'en'}`)}
          </button>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={collapsed ? t('sidebar.signOut') : undefined}
          title={collapsed ? t('sidebar.signOut') : undefined}
          className={cx(linkBase, collapsed ? 'h-11 w-11 justify-center' : 'gap-2.5 px-3 py-[9px]')}
        >
          <Icon name="logout" size={collapsed ? 20 : 18} />
          {!collapsed && t('sidebar.signOut')}
        </button>
      </div>
    </nav>
  );
}
