module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "stylelint --fix"],
  "services/example-exercise/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/example-exercise/ --noEmit",
  "services/cms/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/cms/ --noEmit",
  "services/main-frontend/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/main-frontend/ --noEmit",
  "services/course-material/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/course-material/ --noEmit",
  "services/quizzes/src/**/*.{js,jsx,ts,tsx}": () =>
    "npx tsc -p services/quizzes/ --noEmit",
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
}
