import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    watch: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'utils/tree': path.resolve(__dirname, './src/utils/tree'),
      'utils/logger': path.resolve(__dirname, './src/utils/logger'),
      'utils/browserWsUrl': path.resolve(__dirname, './src/utils/browserWsUrl'),
      'services/mem': path.resolve(__dirname, './src/services/mem'),
      'services/action': path.resolve(__dirname, './src/services/action'),
      'services/a11y': path.resolve(__dirname, './src/services/a11y'),
      '@isomorphic/dom': path.resolve(__dirname, './src/utils/isomorphic/dom'),
      '@isomorphic/contentFormatter': path.resolve(__dirname, './src/utils/isomorphic/contentFormatter'),
    },
  },
});
