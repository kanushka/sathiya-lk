// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { webUrl } from '../../lib/urls';
import { cx } from '../../ui/cx';
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

export function BrandLockup({ layout = 'stacked' }: { layout?: 'stacked' | 'inline' }) {
  const { t, i18n } = useTranslation('common');
  const inline = layout === 'inline';
  return (
    <a
      href={webUrl(i18n.language === 'si' ? '/si/' : '/')}
      className={cx(
        'flex rounded-xl text-ink no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
        inline ? 'items-center gap-3' : 'flex-col items-center gap-2',
      )}
    >
      <BrandMark size={inline ? 52 : 60} />
      <span className={cx('flex flex-col', inline ? 'gap-0.5' : 'items-center gap-1')}>
        <span lang="en" className={cx('font-extrabold leading-none tracking-[-0.02em]', inline ? 'text-[28px]' : 'text-[30px]')}>
          {t('brand.en')}
        </span>
        <span lang="si" className="text-lg font-semibold leading-tight text-teal">
          {t('brand.si')}
        </span>
      </span>
    </a>
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
