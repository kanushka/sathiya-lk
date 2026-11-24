// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { membershipOf, schoolIds, type Lang } from '@sathiya/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { fetchSchoolNames } from '../app/memberSchools';
import { schoolHomePath } from '../app/schoolHome';
import { Select } from './Select';

export interface SchoolSwitcherProps {
  current: string;
  className?: string;
}

export function SchoolSwitcher({ current, className }: SchoolSwitcherProps) {
  const { t, i18n } = useTranslation('shell');
  const lang: Lang = i18n.language === 'si' ? 'si' : 'en';
  const { claims } = useAuth();
  const navigate = useNavigate();
  const ids = useMemo(() => schoolIds(claims).filter((id) => schoolHomePath(claims, id)), [claims]);
  const key = ids.join(',');
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length < 2) return;
    let live = true;
    fetchSchoolNames(list, lang).then(
      (n) => live && setNames(n),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [key, lang]);

  if (ids.length < 2) return null;
  const options = ids.map((id) => ({
    value: id,
    label: `${names[id] ?? id} · ${t(`switcher.roles.${membershipOf(claims, id)?.r === 'a' ? 'admin' : 'teacher'}`)}`,
  }));
  return (
    <Select
      aria-label={t('switcher.label')}
      size="sm"
      value={ids.includes(current) ? current : ''}
      options={options}
      className={className}
      onChange={(id) => {
        const to = schoolHomePath(claims, id);
        if (id !== current && to) navigate(to);
      }}
    />
  );
}
