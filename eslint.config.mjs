import js from '@eslint/js';
import globals from 'globals';

const application = ['app.js', 'src/**/*.{js,mjs}', 'api/**/*.js', 'lib/**/*.js', 'utils/**/*.js', 'service-worker.js'];
export default [
  { ignores: ['node_modules/**', 'dist/**', 'generated/**', '.agent/**', 'output/**'] },
  { files: application, rules: js.configs.recommended.rules },
  { files: ['app.js', 'src/**/*.{js,mjs}'], languageOptions: { globals: globals.browser, sourceType: 'module' } },
  { files: ['api/**/*.js', 'lib/**/*.js', 'utils/**/*.js'], languageOptions: { globals: globals.node, sourceType: 'commonjs' } },
  { files: ['service-worker.js'], languageOptions: { globals: globals.serviceworker, sourceType: 'script' } }
];
