import tseslint from 'typescript-eslint';
import functional from 'eslint-plugin-functional';

// FP enforcement. The pure core (src/lib) is held to the strictest rules:
// no mutation, no loops, no let, no throw. Boundary modules (api, content,
// background) relax the rules that are impossible at an I/O edge.
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.*', 'coverage/**', 'e2e/**', 'skills/**', 'landing/**', 'scripts/**'],
  },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  // Strict FP rules everywhere by default.
  {
    files: ['src/**/*.ts'],
    plugins: { functional },
    rules: {
      'functional/no-let': 'error',
      'functional/immutable-data': 'error',
      'functional/no-classes': 'error',
      'functional/prefer-readonly-type': 'off',
      'functional/no-throw-statements': 'error',
      'functional/no-loop-statements': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  // Boundaries: DOM + network + chrome APIs are inherently effectful.
  // Relax the rules that fight the platform, keep the rest.
  {
    files: [
      'src/api/**/*.ts',
      'src/content/**/*.ts',
      'src/background/**/*.ts',
      'src/settings/**/*.ts',
      'src/popup/**/*.ts',
      'src/components/**/*.ts',
      'src/storage.ts',
    ],
    rules: {
      'functional/immutable-data': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-let': 'off',
    },
  },
);
