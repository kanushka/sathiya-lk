// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { appCheckDeployError, buildEnvInfo, functionsEnvFor, parseDotenv } from './appCheckGuard.mjs';

describe('buildEnvInfo', () => {
  it('records the mode and whether a site key was built in, never the key itself', () => {
    expect(buildEnvInfo('production', { VITE_APPCHECK_SITE_KEY: 'k' })).toEqual({ mode: 'production', appCheckSiteKey: true });
    expect(buildEnvInfo('staging', { VITE_APPCHECK_SITE_KEY: '' })).toEqual({ mode: 'staging', appCheckSiteKey: false });
    expect(buildEnvInfo('production', {})).toEqual({ mode: 'production', appCheckSiteKey: false });
  });
});

describe('parseDotenv', () => {
  it('reads keys, strips quotes and skips comments', () => {
    expect(parseDotenv('# c\nA=1\nB="x y"\n\nC=\nENFORCE_APP_CHECK=false # off\n')).toEqual({ A: '1', B: 'x y', C: '', ENFORCE_APP_CHECK: 'false' });
  });
});

describe('functionsEnvFor', () => {
  it('lets the project file override .env', () => {
    const files: Record<string, string> = { '.env': 'ENFORCE_APP_CHECK=false\nA=1', '.env.p': 'ENFORCE_APP_CHECK=true' };
    expect(functionsEnvFor('p', (name) => files[name])).toEqual({ ENFORCE_APP_CHECK: 'true', A: '1' });
    expect(functionsEnvFor('q', (name) => files[name])).toEqual({ ENFORCE_APP_CHECK: 'false', A: '1' });
  });
});

describe('appCheckDeployError', () => {
  const withKey = { mode: 'production', appCheckSiteKey: true };
  const noKey = { mode: 'production', appCheckSiteKey: false };

  it('passes a build with a site key', () => {
    expect(appCheckDeployError({ build: withKey, functionsEnv: {}, project: 'sathiya-lk' })).toBeNull();
  });

  it('fails a build without a site key while functions enforce App Check', () => {
    const error = appCheckDeployError({ build: noKey, functionsEnv: {}, project: 'sathiya-lk' });
    expect(error).toMatch(/VITE_APPCHECK_SITE_KEY/);
    expect(error).toMatch(/apps\/app\/\.env\.production/);
    expect(error).toMatch(/functions\/\.env\.sathiya-lk/);
    expect(appCheckDeployError({ build: noKey, functionsEnv: { ENFORCE_APP_CHECK: 'true' }, project: 'sathiya-lk' })).not.toBeNull();
  });

  it('passes a build without a site key when enforcement is explicitly off', () => {
    expect(appCheckDeployError({ build: noKey, functionsEnv: { ENFORCE_APP_CHECK: 'false' }, project: 'sathiya-lk' })).toBeNull();
  });

  it('fails when the build info is missing', () => {
    expect(appCheckDeployError({ build: null, functionsEnv: { ENFORCE_APP_CHECK: 'false' }, project: 'sathiya-lk' })).toMatch(/build the app/i);
  });
});
