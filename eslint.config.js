import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      // The app builds HTML strings for Leaflet popups/tooltips and escapes
      // every interpolation, so v-html itself is not used.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Deliberately allows console.warn/error for source-failure diagnostics;
      // console.log is what we want to keep out.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Component-local conventions: keep prop casing flexible for the
      // single-file template style already in use.
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
    },
  },

  // Node-side test files: console output IS the test report here
  {
    files: ['tests/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // vite.config.js uses `import pkg from './package.json' with { type: 'json' }`,
  // an import-attribute syntax older parsers reject.
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
]
