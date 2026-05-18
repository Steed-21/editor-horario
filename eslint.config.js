// Configuración ESLint plana (flat config, ESLint 9+).
// Reglas conservadoras: pilla imports rotos, variables sin uso y referencias
// indefinidas — exactamente la clase de bugs que tuvimos (CLOSE24).
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/config/data.json',
      'vercel-import.env',
      '.env*',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Variables sin usar → solo warning, y permite el prefijo "_" para ignorar.
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Referencias a símbolos no definidos → error.
      'no-undef': 'error',
      // console.log permitido (lo usamos para diagnóstico).
      'no-console': 'off',
      // Permitir vacío en catches (estilo del código existente).
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
