// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useTranslation } from 'react-i18next';

const READY = { en: 'Getting your week ready…', si: 'ඔබේ සතිය සූදානම් කරමින්…' } as const;
const PERIODS = 7;

export function LoadingState() {
  const { t, i18n } = useTranslation('shell');
  const [first, second] = i18n.language?.startsWith('si') ? (['si', 'en'] as const) : (['en', 'si'] as const);
  return (
    <div role="status" className="loading-bell flex min-h-[50vh] flex-col items-center justify-center gap-5">
      <span className="sr-only">{t('loading')}</span>
      <svg
        aria-hidden="true"
        className="loading-bell-icon h-11 w-11 text-brand-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      <span aria-hidden="true" className="relative h-7 w-72 text-center text-lg font-semibold text-ink">
        <span lang={first} className="loading-bell-a absolute inset-0">
          {READY[first]}
        </span>
        <span lang={second} className="loading-bell-b absolute inset-0">
          {READY[second]}
        </span>
      </span>
      <span aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: PERIODS }, (_, i) => (
          <span key={i} className="loading-bell-period h-1.5 w-[22px] rounded-full bg-line" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </span>
    </div>
  );
}
