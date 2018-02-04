'use strict';

module.exports = {
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 6
  },
  env: {
    node: true
  },
  rules: {
    'no-console': 'off',
  },
  overrides: [{
    files: ['tests/**/*.js'],
    env: {
      mocha: true,
    }
  }],
};