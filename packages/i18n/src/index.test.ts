// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { createI18n, namespaces, resources } from './index';

function leaves(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('includes common namespace', () => {
    expect(namespaces).toContain('common');
  });

  it('translates in en and si', () => {
    expect(createI18n('en').t('common:days.short.0')).toBe('Mon');
    expect(createI18n('si').t('common:days.short.0')).toBe('සඳු');
  });

  it('falls back to english for missing keys', () => {
    const i18n = createI18n('si');
    i18n.addResource('en', 'common', 'testOnly', 'English only');
    expect(i18n.t('common:testOnly')).toBe('English only');
  });

  it('falls back to english for empty si strings', () => {
    const i18n = createI18n('si');
    i18n.addResource('en', 'common', 'emptyKey', 'English text');
    i18n.addResource('si', 'common', 'emptyKey', '');
    expect(i18n.t('common:emptyKey')).toBe('English text');
  });

  it('si has every en key and no orphan namespaces', () => {
    const res = resources();
    const missing: string[] = [];
    for (const ns of Object.keys(res.en)) {
      const si = res.si[ns];
      const siKeys = new Set(si ? leaves(si) : []);
      for (const k of leaves(res.en[ns])) if (!siKeys.has(k)) missing.push(`${ns}:${k}`);
    }
    expect(missing, `missing si keys:\n${missing.join('\n')}`).toEqual([]);
    const orphans = Object.keys(res.si).filter((ns) => !(ns in res.en));
    expect(orphans).toEqual([]);
  });
});
