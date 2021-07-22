module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "stylelint --fix"],
  "services/example-exercise/**/*.{js,jsx,ts,tsx}": () => "npx tsc -p services/example-exercise/ --noEmit",
  "services/cms/**/*.{js,jsx,ts,tsx}": () => "bash -c 'npx tsc -p services/cms/ --noEmit'",
  "services/main-frontend/**/*.{js,jsx,ts,tsx}": () => "bash -c 'npx tsc -p services/main-frontend/ --noEmit'",
  "services/course-material/**/*.{js,jsx,ts,tsx}": () => "bash -c 'npx tsc -p services/course-material/ --noEmit'",
  "*.{md,json,scss,css}": "prettier --write",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml -- --files-with-diff",
    "cargo clippy --manifest-path services/headless-lms/Cargo.toml -- -D warnings",
  ],
  "**/models/**/*.rs": () => [
    "./services/headless-lms/bin/sqlx-prepare-check",
  ],
}
