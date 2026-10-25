const expo = require("jest-expo/jest-preset");

// Metro compiles the app with React Compiler; babel-jest does not unless asked, so tests would run different code.
const SOURCE = "\\.[jt]sx?$";
const [babelJest, babelOptions] = expo.transform[SOURCE];

module.exports = {
  preset: "jest-expo",
  transform: {
    ...expo.transform,
    [SOURCE]: [babelJest, { ...babelOptions, caller: { ...babelOptions.caller, supportsReactCompiler: true } }],
  },
  // A cold React Compiler transform made each file's first render exceed 5 s on CI.
  testTimeout: 20_000,
  roots: ["<rootDir>/test"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
};
