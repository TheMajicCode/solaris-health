import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'backend', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // React 19's automatic JSX runtime makes the React import optional.
      // Unused vars/imports are surfaced as warnings (pre-existing tech debt).
      'no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^(React|_)', argsIgnorePattern: '^_' },
      ],
      // Stylistic / advisory hook rules are surfaced as warnings, not blockers.
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Test files use Vitest globals (describe/it/expect/vi) + jsdom.
    files: ['src/**/*.{test,spec}.{js,jsx}', 'src/__tests__/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
])
