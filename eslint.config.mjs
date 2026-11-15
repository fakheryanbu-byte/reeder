import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'server/**/*', 'api/**/*', 'tests/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
