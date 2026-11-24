// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, type Lang } from '@sathiya/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useSchool, useYear } from '../app/SchoolProvider';
import { IconButton } from './IconButton';
import { PHONE_QUERY, useMediaQuery } from './PhoneNotice';
import { PhoneMenu } from './PhoneMenu';
import { SchoolLogo } from './Sidebar';

export interface PhoneTopBarProps {
  basePath?: string;
  readOnly?: boolean;
}

export function PhoneTopBar({ basePath = '/admin', readOnly = false }: PhoneTopBarProps) {
  const { t, i18n } = useTranslation('shell');
  const lang: Lang = i18n.language === 'si' ? 'si' : 'en';
  const { school } = useSchool();
  const { years, yearId } = useYear();
  const { pathname } = useLocation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = useState(false);
  const name = pickName(school, lang);
  const currentYear = years.find((y) => y.id === yearId);

  useEffect(() => setOpen(false), [pathname, isPhone]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 md:hidden">
      <SchoolLogo school={school} name={name} decorative />
      <strong className="min-w-0 flex-1 truncate text-sm text-ink">{name}</strong>
      {currentYear && <span className="shrink-0 text-[11px] font-extrabold text-brand">{currentYear.label}</span>}
      <IconButton
        icon="menu"
        label={t('nav.openMenu')}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-mr-1.5 h-11 w-11"
      />
      {open && isPhone && <PhoneMenu basePath={basePath} readOnly={readOnly} onClose={() => setOpen(false)} />}
    </header>
  );
}
