// Runs on precommit.
// Focuses on tests that are fast to run don't fail often. For other checks, see bin/git-run-branch-ready-checks and lint-staged.branch-ready.config.js
module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "stylelint --fix lax"],
  "*.{md,json,scss,css}": "prettier --write",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml --all -- --files-with-diff",
  ],
  "system-tests/src/**/*.{js,jsx,ts,tsx}": () => [
    `./bin/check-no-test-only-in-system-tests`,
  ],
  "shared-module/packages/common/src/locales/**/*.json": () => ["./bin/translations-sort"],
}
