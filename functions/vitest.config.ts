import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const core = (f: string) => fileURLToPath(new URL(`../packages/core/src/${f}`, import.meta.url));

export default defineConfig({
  resolve: { alias: { '@sathiya/core/fixtures': core('fixtures.ts'), '@sathiya/core': core('index.ts') } },
  test: { include: ['test/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000, fileParallelism: false },
});
