import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Lets the pre-commit hook pass before the first test file exists.
    passWithNoTests: true,
  },
});
