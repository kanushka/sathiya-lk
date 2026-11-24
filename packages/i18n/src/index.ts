// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import i18next, { type i18n } from 'i18next';
import type { Lang } from '@sathiya/core';

// Vite-only (import.meta.glob): Node-only consumers such as Cloud Functions must not import this package.
const modules = import.meta.glob<Record<string, unknown>>('./*/*.json', {
  eager: true,
  import: 'default',
});

const bundles: Record<Lang, Record<string, Record<string, unknown>>> = { en: {}, si: {} };
for (const [path, content] of Object.entries(modules)) {
  const m = /^\.\/(en|si)\/(.+)\.json$/.exec(path);
  if (m) bundles[m[1] as Lang][m[2] as string] = content;
}

export const namespaces: string[] = Object.keys(bundles.en).sort();

export function resources(): Record<Lang, Record<string, object>> {
  return bundles;
}

export function createI18n(lang: Lang): i18n {
  const instance = i18next.createInstance();
  void instance.init({
    lng: lang,
    fallbackLng: 'en',
    returnEmptyString: false,
    returnNull: false,
    ns: namespaces,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    initAsync: false,
    resources: structuredClone(bundles),
  });
  return instance;
}
