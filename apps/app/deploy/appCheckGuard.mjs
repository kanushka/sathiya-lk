// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export const BUILD_ENV_FILE = '.build-env.json';

/**
 * @typedef {{ mode: string; appCheckSiteKey: boolean }} BuildEnv
 */

/**
 * @param {string} mode
 * @param {Record<string, string | undefined>} env
 * @returns {BuildEnv}
 */
export function buildEnvInfo(mode, env) {
  return { mode, appCheckSiteKey: Boolean(env.VITE_APPCHECK_SITE_KEY) };
}

/**
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseDotenv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = (m[2] ?? '').trim();
    const quoted = /^(["'])(.*)\1/.exec(value);
    value = quoted ? (quoted[2] ?? '') : value.replace(/\s+#.*$/, '');
    out[m[1] ?? ''] = value;
  }
  return out;
}

/**
 * @param {string} project
 * @param {(name: string) => string | undefined} read
 * @returns {Record<string, string>}
 */
export function functionsEnvFor(project, read) {
  return { ...parseDotenv(read('.env') ?? ''), ...parseDotenv(read(`.env.${project}`) ?? '') };
}

/**
 * @param {{ build: BuildEnv | null; functionsEnv: Record<string, string>; project: string }} input
 * @returns {string | null}
 */
export function appCheckDeployError({ build, functionsEnv, project }) {
  if (!build) return `apps/app/dist/${BUILD_ENV_FILE} is missing: build the app (pnpm build or pnpm build:staging) before deploying.`;
  if (build.appCheckSiteKey || functionsEnv.ENFORCE_APP_CHECK === 'false') return null;
  return [
    `The app build (mode "${build.mode}") has no VITE_APPCHECK_SITE_KEY, but functions in ${project} enforce App Check, so every callable would fail.`,
    `Set the reCAPTCHA Enterprise site key in apps/app/.env.${build.mode} and rebuild,`,
    `or turn enforcement off with ENFORCE_APP_CHECK=false in functions/.env.${project} (see docs/deploy.md).`,
  ].join('\n');
}
