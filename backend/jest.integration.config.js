// jest config for integration tests — extends base, adds globalSetup to run migrations
'use strict';

module.exports = {
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testMatch: ['**/__tests__/**/*.integration.test.js'],
  globalSetup: './jest.integration.setup.js',
};
