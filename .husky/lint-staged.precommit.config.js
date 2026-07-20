// Runs on precommit. Autofixers that apply changes but never fail the commit: oxlint --fix
// (safe only, via bin/oxlint-autofix), oxfmt, sorting. The failing gates live in
// bin/git-run-branch-ready-checks and CI (oxlint --max-warnings=0). Safe --fix only here, never
// --fix-suggestions/--fix-dangerously, which can change semantics.
export default {
  // bin/oxlint-autofix: safe oxlint fixes, always exits 0; runs before oxfmt.
  // --no-error-on-unmatched-pattern tolerates a fully oxfmt-ignored fileset.
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
