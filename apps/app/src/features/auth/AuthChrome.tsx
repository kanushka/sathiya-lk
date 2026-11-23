// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { SegmentedControl } from '../../ui/SegmentedControl';

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="8" fill="#0E6B6A" />
      <path d="M8 12h18M8 17h18M8 22h18M14 8v18M20 8v18" stroke="#FBFAF7" strokeWidth="1.6" />
      <rect x="20" y="17" width="6" height="5" fill="#F2A541" />
    </svg>
  );
}

export function BrandLockup({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="flex flex-col gap-0.5">
        <span lang="en" className="text-2xl font-extrabold leading-none tracking-[-0.02em]">
          Sathiya
        </span>
        <span lang="si" className="text-[15px] font-semibold leading-tight text-teal">
          සතිය
        </span>
      </span>
    </div>
  );
}

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const { t } = useTranslation(['common', 'shell']);
  return (
    <SegmentedControl
      aria-label={t('shell:sidebar.language')}
      value={lang}
      onChange={setLang}
      options={(['si', 'en'] as const).map((l) => ({
        value: l,
        label: <span lang={l}>{t(`common:languages.${l}`)}</span>,
      }))}
    />
  );
}
