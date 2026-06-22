import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Integration tests share a single in-process Express app + Prisma client.
    fileParallelism: false,
  },
});
