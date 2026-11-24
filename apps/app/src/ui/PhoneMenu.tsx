// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, teacherIdOf, type Lang } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { useMaybeLang } from '../app/LangProvider';
import { useSchool, useYear } from '../app/SchoolProvider';
import { SuperAdminLink } from '../features/superadmin/SuperAdminLink';
import { cx } from './cx';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { SchoolSwitcher } from './SchoolSwitcher';
import { Select } from './Select';
import { groups, linkActive, linkBase, navHref, navItems } from './Sidebar';

export interface PhoneMenuProps {
  basePath?: string;
  readOnly: boolean;
  onClose: () => void;
}

const item = 'min-h-11 gap-3 px-3 py-2.5 text-[15px]';
const heading = 'mx-3 mb-1 mt-5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted';

export function PhoneMenu({ basePath: baseProp, readOnly, onClose }: PhoneMenuProps) {
  const { t, i18n } = useTranslation('shell');
  const lang: Lang = i18n.language === 'si' ? 'si' : 'en';
  const { claims, signOut } = useAuth();
  const { school } = useSchool();
  const { years, yearId, setYearId } = useYear();
  const langCtl = useMaybeLang();
  const name = pickName(school, lang);
  const basePath = baseProp ?? `/s/${school.id}/admin`;
  const yearSelectId = 'phone-menu-year';

  return (
    <Modal
      open
      fullScreen
      title={name}
      subtitle={readOnly ? t('sidebar.readOnly') : t('sidebar.admin')}
      closeLabel={t('nav.closeMenu')}
      onClose={onClose}
    >
      <div className="flex min-h-full flex-col">
      <div className="px-4 pt-4">
        {!readOnly && <SchoolSwitcher current={school.id} className="mb-4 w-full" />}
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
                  onClick={onClose}
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
        {teacherIdOf(claims, school.id) && !readOnly && (
          <NavLink to={`/s/${school.id}/me`} onClick={onClose} className={cx(linkBase, item)}>
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
      </div>
    </Modal>
  );
}
