module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/test/setupEnv.js"], // Ensure Jest finds setupEnv.js in `cdk/test/`
  roots: ["<rootDir>/"], // Ensure Jest looks in `cdk`
  moduleDirectories: ["node_modules", "<rootDir>"],
  testMatch: ["**/*.test.js"], // Ensure Jest finds test files
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
