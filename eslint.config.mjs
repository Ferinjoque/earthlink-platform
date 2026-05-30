import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-plugin-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Prettier
  {
    plugins: { prettier },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // Permitir parámetros con prefijo _ sin disparar no-unused-vars
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // El patrón toast(state.error) dentro de useEffect es estándar con Server Actions.
      // La regla es demasiado estricta para este caso de uso.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // Module boundary rules — keeps calc/ pure (no I/O imports)
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'calc', pattern: 'src/calc/**' },
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'repos', pattern: 'src/repos/**' },
        { type: 'services', pattern: 'src/services/**' },
        { type: 'actions', pattern: 'src/actions/**' },
        { type: 'lib', pattern: 'src/lib/**' },
        { type: 'components', pattern: 'src/components/**' },
        { type: 'app', pattern: 'app/**' },
        { type: 'types', pattern: 'src/types/**' },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // calc/ MUST NOT import repos, services, supabase, app, components
            {
              from: 'calc',
              disallow: ['repos', 'services', 'app', 'components'],
              message:
                'calc/ must be pure — no I/O or framework imports. Violation: ${file.type} → ${dependency.type}',
            },
          ],
        },
      ],
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'tests/e2e/**',
    'supabase/**',
    '*.config.*',
  ]),
]);

export default eslintConfig;
