/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    // ts-jest + CommonJS: resolve .js imports to .ts source files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
