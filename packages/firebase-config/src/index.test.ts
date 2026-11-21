// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { appConfig, appConfigFor, webConfig, webConfigFor } from './index';

describe('firebase config selection', () => {
  it('defaults to production', () => {
    expect(appConfigFor(undefined)).toBe(appConfig);
    expect(appConfigFor('')).toBe(appConfig);
    expect(appConfigFor('production')).toBe(appConfig);
    expect(webConfigFor(undefined)).toBe(webConfig);
  });

  it('selects the staging project', () => {
    expect(appConfigFor('staging').projectId).toBe('sathiya-lk-staging');
    expect(webConfigFor('staging').projectId).toBe('sathiya-lk-staging');
    expect(appConfigFor('staging').appId).not.toBe(appConfig.appId);
  });
});
