// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    // The public /welcome marketing deck is a VERBATIM, off-system port from
    // v1 (inline brand styling, v1 idioms: *ngIf/ViewChild/constructor DI).
    // Exempt from v2's signal / control-flow / a11y lint rigor — same
    // rationale as the check-style-guards EXEMPT. It passed v1's checks and
    // is ported unchanged ("don't change unless we have to" — Liam).
    ignores: ['src/app/public/welcome/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    // Typed linting — required by @angular-eslint/no-uncalled-signals.
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // v2 signal rigor (post-audit, v2.04a): enforce the signal idioms
      // mechanically instead of by convention — One Application, default-on.
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-uncalled-signals': 'error',
      '@angular-eslint/computed-must-return': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // v2 signal rigor: ban ! assertions in templates (narrow with @if instead).
      '@angular-eslint/template/no-non-null-assertion': 'error',
    },
  },
]);
