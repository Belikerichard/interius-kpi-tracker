export default [
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        Chart: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];
