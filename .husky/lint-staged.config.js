module.exports = {
  "*.js,*.ts,*.jsx,*.tsx": ["eslint --cache --fix", "stylelint --fix"],
  "*.md,*.json,*.scss,*.css": "prettier --write",
  "*.rs": () => [
    "cargo fmt --manifest-path headless-lms/Cargo.toml -- --files-with-diff",
    "cargo clippy --manifest-path headless-lms/Cargo.toml -- -D warnings",
  ],
}
