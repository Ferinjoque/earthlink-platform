import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/calc/pipeline.ts',
        'src/domain/**/*.ts',
        'src/repos/Repository.ts',
        'src/repos/InMemoryRepository.ts',
      ],
      exclude: [
        // Types-only files — no runtime coverage possible
        'src/calc/types.ts',
        'src/calc/version.ts',
        'src/calc/index.ts',
        // Infrastructure — integration-tested, not unit-tested
        'src/repos/Supabase*.ts',
        'src/repos/*Repository.ts',
        'src/services/**',
        'src/lib/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
