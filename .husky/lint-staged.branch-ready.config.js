// Runs when you run bin/git-run-branch-ready-checks.
// These checks are slower and more likely to fail than the precommit checks.
// See lint-staged.precommit.config.js for precommit checks.
export default {
  "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "stylelint --fix lax"],
  "services/example-exercise/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/example-exercise/ --noEmit",
  "services/cms/src/**/*.{js,jsx,ts,tsx}": () => "npx tsc -p services/cms/ --noEmit",
  "services/main-frontend/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/main-frontend/ --noEmit",
  "services/course-material/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/course-material/ --noEmit",
  "services/quizzes/src/**/*.{js,jsx,ts,tsx}": () => "npx tsc -p services/quizzes/ --noEmit",
  "services/tmc/src/**/*.{js,jsx,ts,tsx}": () => "npx tsc -p services/tmc/ --noEmit",
  "*.{md,json,scss,css}": "prettier --write",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml --all -- --files-with-diff",
    "cargo clippy --manifest-path services/headless-lms/Cargo.toml -- -D warnings",
  ],
  "**/models/**/*.rs": () => ["./bin/sqlx-prepare-check"],
  "system-tests/src/**/*.{js,jsx,ts,tsx}": () => [
    `./bin/check-no-test-only-in-system-tests`,
    "npx tsc -p system-tests --noEmit",
  ],
  "shared-module/packages/common/src/locales/**/*.json": () => ["./bin/translations-sort"],
  ".github/workflows/**/*.{yaml,yml}": () => ["actionlint"],
}
