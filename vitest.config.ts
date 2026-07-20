import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': './src',
      '@bot': './src/bot',
      '@modules': './src/modules',
      '@services': './src/services',
      '@utils': './src/utils',
    },
  },
});
