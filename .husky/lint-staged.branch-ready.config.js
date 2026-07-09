// Runs when you run bin/git-run-branch-ready-checks. This is the "finishing touches" pass: it
// applies the remaining autofixes AND runs the slow, failing gates (lint, type-check, clippy,
// sqlx, actionlint) so you catch what CI (.github/workflows/code-style.yml + tests.yml) would
// catch before pushing. See lint-staged.precommit.config.js for the fast per-commit formatters.
export default {
  // oxfmt --no-error-on-unmatched-pattern: tolerate a fileset that is entirely oxfmt-ignored
  // (e.g. generated *.guard.ts), which otherwise makes oxfmt exit non-zero.
  "*.{js,jsx,ts,tsx}": ["oxlint --fix", "oxfmt --no-error-on-unmatched-pattern", "stylelint --fix"],
  "services/example-exercise/src/**/*.{js,jsx,ts,tsx}": () =>
    "pnpm exec tsc -p services/example-exercise/ --noEmit",
  "services/cms/src/**/*.{js,jsx,ts,tsx}": () => "pnpm exec tsc -p services/cms/ --noEmit",
  "services/main-frontend/src/**/*.{js,jsx,ts,tsx}": () =>
    "pnpm exec tsc -p services/main-frontend/ --noEmit",
  "services/quizzes/src/**/*.{js,jsx,ts,tsx}": () => "pnpm exec tsc -p services/quizzes/ --noEmit",
  "services/tmc/src/**/*.{js,jsx,ts,tsx}": () => "pnpm exec tsc -p services/tmc/ --noEmit",
  "*.{md,json,scss,css}": "oxfmt --no-error-on-unmatched-pattern",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml --all -- --files-with-diff",
    "cargo clippy --manifest-path services/headless-lms/Cargo.toml -- -D warnings",
  ],
  "**/models/**/*.rs": () => ["./bin/sqlx-prepare-check"],
  "system-tests/src/**/*.{js,jsx,ts,tsx}": () => [
    `./bin/check-no-test-only-in-system-tests`,
    "pnpm exec tsc -p system-tests --noEmit",
  ],
  "shared-module/packages/common/src/locales/**/*.json": () => ["./bin/translations-sort"],
  ".github/workflows/**/*.{yaml,yml}": () => ["actionlint"],
}
