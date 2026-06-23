import { defineConfig } from 'vitest/config';

// Live integration tests that hit the real GitHub API. Separate from the
// hermetic unit suite (vitest.config.ts) so `npm test` never touches the
// network. Run with: npm run test:e2e (requires E2E_GH_TOKEN + repo env vars).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
