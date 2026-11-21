// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { cx } from '../../ui/cx';

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="8" fill="#0E6B6A" />
      <path d="M8 12h18M8 17h18M8 22h18M14 8v18M20 8v18" stroke="#FBFAF7" strokeWidth="1.6" />
      <rect x="20" y="17" width="6" height="5" fill="#F2A541" />
    </svg>
  );
}

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const { t } = useTranslation('common');
  const base = 'cursor-pointer border-0 px-3 py-1.5 text-[13px]';
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[#D9DCE3] bg-white">
      {(['si', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cx(base, lang === l ? 'bg-navy text-white' : 'bg-white text-ink-soft')}
        >
          {t(`languages.${l}`)}
        </button>
      ))}
    </div>
  );
}
