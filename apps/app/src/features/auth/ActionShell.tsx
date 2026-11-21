// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark, LanguageToggle } from './AuthChrome';

export function ActionShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen flex-col items-center bg-ground px-4 py-10 sm:py-12">
      <div className="mb-9 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-2xl font-extrabold">{t('brand')}</span>
      </div>
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-white p-5 sm:p-8">
        <p className="m-0 text-[13px] font-bold uppercase tracking-[.06em] text-teal">{t('action.eyebrow')}</p>
        <h1 className="mb-4 mt-1.5 text-[26px] font-bold">{title}</h1>
        {children}
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
    </div>
  );
}

export function ActionError({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 text-sm font-medium text-[#A3262A]">
      {message}
    </p>
  );
}
