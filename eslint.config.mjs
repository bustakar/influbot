import eslintPlugin from '@eslint/js';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    name: 'project/ignores',
    ignores: [
      '.next/',
      'node_modules/',
      'public/',
      '.vscode/',
      'next-env.d.ts',
      'src/_generated/**',
    ],
  },
  {
    name: 'project/javascript-recommended',
    files: ['**/*.{js,mjs,cjs}'],
    ...eslintPlugin.configs.recommended,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    name: `typescript-eslint/${config.name}`,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    name: 'project/import-sorting',
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  prettier, // Must be last to override conflicting rules
]);
