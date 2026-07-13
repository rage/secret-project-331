// Runs on precommit.
// Fast autofixers that APPLY changes but must NEVER fail the commit: oxlint --fix (safe fixes only,
// via bin/oxlint-autofix which always exits 0), formatting, and sorting. Committing work-in-progress
// stays friction-free; the FAILING lint / type-check gates live in bin/git-run-branch-ready-checks
// (lint-staged.branch-ready.config.js) and in CI (.github/workflows/code-style.yml + tests.yml),
// which run `oxlint --max-warnings=0`.
// NOTE: only the safe `oxlint --fix` level runs here (never --fix-suggestions / --fix-dangerously,
// which historically changed semantics, e.g. unicorn/no-useless-undefined stripping a required
// `undefined` arg); anything a safe autofix still breaks is caught by the downstream tsc + CI gates.
export default {
  // ./bin/oxlint-autofix applies oxlint's safe autofixes and always exits 0 (never blocks a commit).
  // It runs before oxfmt so formatting is the final pass.
  // --no-error-on-unmatched-pattern: staging only oxfmt-ignored files (e.g. generated *.guard.ts)
  // otherwise makes oxfmt exit non-zero with "Expected at least one target file".
  "*.{js,jsx,ts,tsx}": ["./bin/oxlint-autofix", "oxfmt --no-error-on-unmatched-pattern"],
  "*.{md,json,scss,css}": "oxfmt --no-error-on-unmatched-pattern",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml --all -- --files-with-diff",
  ],
  // Cheap guard, not a formatter: a stray test.only silently disables the rest of a suite, so it's
  // worth blocking at commit time. Fails only on an actual mistake.
  "system-tests/src/**/*.{js,jsx,ts,tsx}": () => [`./bin/check-no-test-only-in-system-tests`],
  "shared-module/packages/common/src/locales/**/*.json": () => ["./bin/translations-sort"],
}
