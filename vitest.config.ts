
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'extension/src/__tests__/**/*.test.ts',
      'extension/src/__tests__/**/*.spec.ts',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['extension/src/**/*.ts', 'extension/src/**/*.tsx'],
      exclude: ['extension/src/**/*.test.ts', 'extension/src/**/__tests__/**'],
    },
    setupFiles: [],
    testTimeout: 10000,
  },
});