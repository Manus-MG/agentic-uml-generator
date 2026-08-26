import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The jar-backed diagram checks start a JVM per diagram.
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // `env()` refuses to start on a missing key; tests never reach the network,
    // so placeholders are enough to let the modules load.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/umlgenerator_test',
      GROQ_API_KEY: process.env.GROQ_API_KEY ?? 'test-key-not-used',
    },
  },
});
