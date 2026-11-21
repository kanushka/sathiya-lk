import { existsSync } from 'node:fs';
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*',
  'apps/*',
  ...(existsSync('functions') ? ['functions'] : []),
]);
