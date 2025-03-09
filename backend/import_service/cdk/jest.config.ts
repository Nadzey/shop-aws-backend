export default {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(ts|tsx|js)$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json", "node"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
