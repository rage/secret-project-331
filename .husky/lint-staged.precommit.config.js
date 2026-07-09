// Runs on precommit.
// Only fast, deterministic autofixers that (almost) never fail: formatting + sorting.
// Deliberately NO linting or type-checking here — linters/tsc are slower, they fail, and a
// linter's --fix can change semantics (e.g. oxlint's unicorn/no-useless-undefined once stripped a
// required `undefined` arg). Those gates live in bin/git-run-branch-ready-checks
// (lint-staged.branch-ready.config.js) and in CI (.github/workflows/code-style.yml + tests.yml).
export default {
  // --no-error-on-unmatched-pattern: staging only oxfmt-ignored files (e.g. generated *.guard.ts)
  // otherwise makes oxfmt exit non-zero with "Expected at least one target file".
  "*.{js,jsx,ts,tsx}": "oxfmt --no-error-on-unmatched-pattern",
  "*.{md,json,scss,css}": "oxfmt --no-error-on-unmatched-pattern",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml --all -- --files-with-diff",
  ],
  // Cheap guard, not a formatter: a stray test.only silently disables the rest of a suite, so it's
  // worth blocking at commit time. Fails only on an actual mistake.
  "system-tests/src/**/*.{js,jsx,ts,tsx}": () => [`./bin/check-no-test-only-in-system-tests`],
  "shared-module/packages/common/src/locales/**/*.json": () => ["./bin/translations-sort"],
}
