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
        'src/actions/auth.ts',
        'src/actions/activity.ts',
        'src/actions/audit.ts',
        'src/actions/suppliers.ts',
        'src/actions/periods.ts',
        'src/actions/reports.ts',
        'src/lib/csv.ts',
        'src/lib/anomaly.ts',
        'src/lib/format.ts',
        'src/lib/reporting-period.ts',
        'src/proxy.ts',
        'src/services/AuditService.ts',
        'src/services/AnomalyService.ts',
        'src/services/EvaluationService.ts',
      ],
      exclude: [
        // Types-only files — no runtime coverage possible
        'src/calc/types.ts',
        'src/calc/version.ts',
        'src/calc/index.ts',
        // Infrastructure — integration-tested, not unit-tested
        'src/repos/Supabase*.ts',
        'src/repos/*Repository.ts',
        'src/lib/env.ts',
        'src/lib/supplier-constants.ts',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75,
      },
    },
  },
});
