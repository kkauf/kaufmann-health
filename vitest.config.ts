import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts?(x)'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      '**/node_modules/**',
      'tests/e2e/**'
    ],
  },
});
