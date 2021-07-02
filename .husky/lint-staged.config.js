module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --cache --fix", "stylelint --fix"],
  "services/example-exercise/**/*.{js,jsx,ts,tsx}": ["bash -c 'cd services/example-exercise && npx tsc --noEmit'"],
  "services/cms/**/*.{js,jsx,ts,tsx}": ["bash -c 'cd services/cms && npx tsc --noEmit'"],
  "*.{md,json,scss,css}": "prettier --write",
  "*.rs": () => [
    "cargo fmt --manifest-path services/headless-lms/Cargo.toml -- --files-with-diff",
    "cargo clippy --manifest-path services/headless-lms/Cargo.toml -- -D warnings",
  ],
  "**/models/**/*.rs": () => [
    "./services/headless-lms/bin/sqlx-prepare-check",
  ],
}
