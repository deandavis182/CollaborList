'use strict';
// jest.setup.js — setupFilesAfterEnv hook
//
// Problem being solved:
//   When a test file calls jest.mock('module', factory) at the top level AND
//   ALSO calls jest.resetModules() in beforeEach, the _mockRegistry is cleared
//   on each test. Subsequent require('module') calls the factory again, producing
//   a NEW mock object that is different from the top-level `const mock = require('module')`.
//   This makes assertions like `expect(mock.someMethod).toHaveBeenCalled()` fail
//   even though the code DID call someMethod (on the new instance).
//
// Solution:
//   Before each test, capture any currently-active factory-mocked modules via
//   jest.requireMock(), then register a no-op doMock factory that returns the
//   SAME captured object. After jest.resetModules() clears _mockRegistry,
//   _mockFactories still contains our closure factory. The next require() gets
//   the ORIGINAL mock object (not a new one from the original factory).
//
// This only affects modules that are actively mocked at the time beforeEach runs.
// It is safe: doMock factories are overridden per-test-file and don't leak.

const MODULES_TO_PRESERVE = ['web-push'];

beforeEach(() => {
  for (const moduleName of MODULES_TO_PRESERVE) {
    let currentMock;
    try {
      currentMock = jest.requireMock(moduleName);
    } catch (_) {
      // Not mocked in this test file — skip.
      continue;
    }
    if (currentMock != null) {
      // Override _mockFactories with a factory that always returns the SAME object.
      // _mockFactories persists across jest.resetModules() (unlike _mockRegistry).
      // This ensures subsequent require(moduleName) returns currentMock.
      jest.doMock(moduleName, () => currentMock);
    }
  }
});
