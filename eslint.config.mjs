import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import perfectionistPlugin from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

// ----------------------------------------------------------------------

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'unused-imports': unusedImportsPlugin,
      perfectionist: perfectionistPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },

    rules: {
      // Base
      'no-alert': 0,
      camelcase: 0,
      'no-console': 0,
      'no-unused-vars': 0,
      'no-param-reassign': 0,
      'no-underscore-dangle': 0,
      'no-restricted-exports': 0,
      'no-promise-executor-return': 0,

      // React
      'react/no-children-prop': 0,
      'react/react-in-jsx-scope': 0,
      'react/no-array-index-key': 0,
      'react/require-default-props': 0,
      'react/jsx-props-no-spreading': 0,
      'react/function-component-definition': 0,
      'react/jsx-no-useless-fragment': [1, { allowExpressions: true }],
      'react/no-unstable-nested-components': [1, { allowAsProps: true }],
      'react/jsx-no-duplicate-props': [1, { ignoreCase: false }],

      // TypeScript
      '@typescript-eslint/naming-convention': 0,
      '@typescript-eslint/no-use-before-define': 0,
      '@typescript-eslint/no-unused-vars': [1, { args: 'none' }],
      '@typescript-eslint/no-explicit-any': 0,

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Imports
      'import/prefer-default-export': 0,

      // Unused imports
      'unused-imports/no-unused-imports': 1,
      'unused-imports/no-unused-vars': [
        0,
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      // Perfectionist
      'perfectionist/sort-named-imports': [1, { order: 'asc', type: 'line-length' }],
      'perfectionist/sort-named-exports': [1, { order: 'asc', type: 'line-length' }],
      'perfectionist/sort-exports': [1, { order: 'asc', type: 'line-length' }],
      'perfectionist/sort-imports': [
        1,
        {
          order: 'asc',
          type: 'line-length',
          newlinesBetweenImports: 'always',
          groups: [
            ['builtin', 'external'],
            'custom-mui',
            'custom-routes',
            'custom-hooks',
            'custom-utils',
            'internal',
            'custom-components',
            'custom-sections',
            'custom-types',
            ['parent', 'sibling', 'index'],
            'object',
            'unknown',
          ],
          customGroups: {
            value: {
              'custom-mui': '@mui/**',
              'custom-routes': 'src/routes/**',
              'custom-hooks': 'src/hooks/**',
              'custom-utils': 'src/utils/**',
              'custom-components': 'src/components/**',
              'custom-sections': 'src/sections/**',
              'custom-types': 'src/types/**',
            },
          },
          internalPattern: ['src/**'],
        },
      ],
    },
  }
);
