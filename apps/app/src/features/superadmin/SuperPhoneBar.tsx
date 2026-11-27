// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { Modal } from '../../ui/Modal';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { linkActive, linkBase } from '../../ui/Sidebar';
import { BrandMark } from '../auth/AuthChrome';
import { superNav } from './nav';

const item = 'min-h-11 gap-3 px-3 py-2.5 text-[15px]';

export interface SuperPhoneBarProps {
  openCount: number;
  schoolHome?: string;
  language?: { label: string; ariaLabel: string; onToggle: () => void };
  onSignOut: () => void;
}

export function SuperPhoneBar({ openCount, schoolHome, language, onSignOut }: SuperPhoneBarProps) {
  const { t } = useTranslation(['superadmin', 'shell']);
  const { pathname } = useLocation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => setOpen(false), [pathname, isPhone]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-white px-4 md:hidden">
      <BrandMark size={28} />
      <strong className="min-w-0 flex-1 truncate text-sm text-ink">{t('brand')}</strong>
      <span className="shrink-0 text-[11px] font-extrabold text-teal">{t('role')}</span>
      <IconButton
        icon="menu"
        label={t('shell:nav.openMenu')}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-mr-1.5 h-11 w-11"
      />
      {open && isPhone && (
        <Modal open fullScreen title={t('brand')} subtitle={t('role')} closeLabel={t('shell:nav.closeMenu')} onClose={close}>
          <div className="flex min-h-full flex-col">
            <nav aria-label={t('nav.label')} className="flex flex-col gap-0.5 px-2 pt-2">
              {superNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={close}
                  className={({ isActive }) => cx(linkBase, item, isActive && linkActive)}
                >
                  <Icon name={n.icon} size={20} />
                  <span className="flex-1">{t(n.labelKey)}</span>
                  {n.to === '/super/reports' && openCount > 0 && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">{openCount}</span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-0.5 border-t border-line-soft px-2 py-3">
              {schoolHome && (
                <NavLink to={schoolHome} onClick={close} className={cx(linkBase, item)}>
                  <Icon name="dashboard" size={20} />
                  {t('nav.schoolAdmin')}
                </NavLink>
              )}
              {language && (
                <button type="button" onClick={language.onToggle} aria-label={language.ariaLabel} className={cx(linkBase, item)}>
                  <span className="w-5" aria-hidden="true" />
                  {language.label}
                </button>
              )}
              <button type="button" onClick={onSignOut} className={cx(linkBase, item)}>
                <Icon name="logout" size={20} />
                {t('shell:sidebar.signOut')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
}
