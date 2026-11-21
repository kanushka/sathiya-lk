// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appCheckDeployError, BUILD_ENV_FILE, functionsEnvFor } from './appCheckGuard.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const project = process.env.GCLOUD_PROJECT;
if (!project) {
  console.error('GCLOUD_PROJECT is not set; run this through firebase deploy or set it to the target project id.');
  process.exit(1);
}

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);
const buildText = read(join(root, 'apps/app/dist', BUILD_ENV_FILE));
const error = appCheckDeployError({
  build: buildText ? JSON.parse(buildText) : null,
  functionsEnv: functionsEnvFor(project, (name) => read(join(root, 'functions', name))),
  project,
});

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`App Check deploy check OK for ${project}.`);
