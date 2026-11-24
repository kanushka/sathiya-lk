// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, type Lang } from '@sathiya/core';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useMaybeLang } from '../app/LangProvider';
import { useSchool, useYear } from '../app/SchoolProvider';
import { SuperAdminLink } from '../features/superadmin/SuperAdminLink';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Select } from './Select';
import { SchoolLogo, groups, linkActive, linkBase, navHref, navItems } from './Sidebar';
import { useDialogTrap } from './useDialogTrap';

export interface PhoneMenuProps {
  basePath: string;
  readOnly: boolean;
  onClose: () => void;
}

const item = 'min-h-11 gap-3 px-3 py-2.5 text-[15px]';
const heading = 'mx-3 mb-1 mt-5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted';

export function PhoneMenu({ basePath, readOnly, onClose }: PhoneMenuProps) {
  const { t, i18n } = useTranslation('shell');
  const lang: Lang = i18n.language === 'si' ? 'si' : 'en';
  const { claims, signOut } = useAuth();
  const { school } = useSchool();
  const { years, yearId, setYearId } = useYear();
  const langCtl = useMaybeLang();
  const panelRef = useRef<HTMLDivElement>(null);
  const name = pickName(school, lang);
  const yearSelectId = 'phone-menu-year';

  useDialogTrap({ panelRef, containerRef: panelRef, onClose });

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.menu')}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)] font-sans text-ink outline-none"
    >
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <SchoolLogo school={school} name={name} decorative />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm leading-tight">{name}</strong>
          <span className="text-xs text-ink-muted">{readOnly ? t('sidebar.readOnly') : t('sidebar.admin')}</span>
        </div>
        <IconButton icon="close" label={t('nav.closeMenu')} variant="subtle" onClick={onClose} className="h-11 w-11" />
      </div>

      <div className="px-4 pt-4">
        {years.length === 0 ? (
          <>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted">{t('sidebar.year')}</p>
            <p className="text-sm text-ink-muted">{t('sidebar.noYears')}</p>
          </>
        ) : (
          <>
            <label htmlFor={yearSelectId} className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted">
              {t('sidebar.year')}
            </label>
            <Select
              id={yearSelectId}
              value={yearId}
              onChange={setYearId}
              className="w-full"
              options={years.map((y) => ({
                value: y.id,
                label: t('year.option', { label: y.label, status: t(`year.${y.status}`) }),
              }))}
            />
          </>
        )}
      </div>

      <nav aria-label={t('nav.menu')} className="flex flex-col px-2 pt-2">
        {groups.map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            {group !== 'main' && <p className={heading}>{t(`nav.groups.${group}`)}</p>}
            {navItems
              .filter((i) => i.group === group)
              .map((i) => (
                <NavLink
                  key={i.path}
                  to={navHref(basePath, i.path)}
                  end={i.path === '/admin'}
                  className={({ isActive }) => cx(linkBase, item, isActive && linkActive)}
                >
                  <Icon name={i.icon} size={20} />
                  {t(i.labelKey)}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-line-soft px-2 py-3">
        {claims.tid && !readOnly && (
          <NavLink to="/me" className={cx(linkBase, item)}>
            <Icon name="calendar" size={20} />
            {t('nav.myTimetable')}
          </NavLink>
        )}
        <SuperAdminLink className={cx(linkBase, item)} />
        {langCtl && (
          <button
            type="button"
            onClick={() => langCtl.setLang(langCtl.lang === 'en' ? 'si' : 'en')}
            aria-label={`${t('sidebar.language')}: ${t(`common:languages.${langCtl.lang === 'en' ? 'si' : 'en'}`)}`}
            className={cx(linkBase, item)}
          >
            {t(`common:languages.${langCtl.lang === 'en' ? 'si' : 'en'}`)}
          </button>
        )}
        <button type="button" onClick={() => void signOut()} className={cx(linkBase, item)}>
          <Icon name="logout" size={20} />
          {t('sidebar.signOut')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
