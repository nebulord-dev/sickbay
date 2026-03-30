import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'react', 'react-hooks'],
  ignorePatterns: [
    'dist/**',
    '.turbo/**',
    'coverage/**',
    'build/**',
    'fixtures/**',
  ],
  rules: {
    // TypeScript
    'no-unused-vars': 'warn',
    'typescript/no-explicit-any': 'warn',

    // React
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
});
