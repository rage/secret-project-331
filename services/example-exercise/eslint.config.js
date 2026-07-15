// Standalone ESLint config. Its one job is to run the repo's `i18next/no-literal-string` rule so
// an *extracted* project (outside the monorepo) can still catch untranslated UI strings — the same
// rule the source carries `// eslint-disable-next-line i18next/no-literal-string` comments for. In
// the monorepo the root `eslint.config.js` already lints these files; this local copy keeps the
// check self-contained after `create-exercise-service` copies the template out.
//
// Requires these devDependencies (add with `pnpm add -D` in a standalone checkout; they are not
// declared here so they can't disturb the pinned lockfile the scaffolder installs):
//   eslint  @typescript-eslint/parser  eslint-plugin-i18next
import tsParser from "@typescript-eslint/parser"
import i18next from "eslint-plugin-i18next"

// Emotion `css`/`styled` template literals look like prose to the rule; these excludes (mirrored
// from the monorepo config) stop CSS declarations, units, colors and glyphs from being flagged.
const DETECT_CSS_REGEX = /:.*;/
const DETECT_CSS_REGEX_2 = /!important/
const DETECT_CSS_REGEX_3 = /;.*:/s
const DETECT_PX_REGEX = /^\d+px$/
const DETECT_REM_REGEX = /^\d+rem$/
const DETECT_EM_REGEX = /^\d+em$/
const DETECT_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$|^(?:rgb|rgba|hsl|hsla)\(.*\)$/

export default [
  {
    // Framework-generated route/boilerplate files carry disable-directives for rules from other
    // monorepo plugins (e.g. `@next/next/no-head-element`) that this minimal config doesn't define,
    // so we lint the exercise's own components — where the untranslated-string risk actually lives.
    ignores: [
      "dist/**",
      "src/shared-module/**",
      "src/routes/**",
      "src/routeTree.gen.ts",
      "**/*.test.{ts,tsx}",
    ],
  },
  {
    // Match the monorepo: `mode: "all"` applies to JSX/TSX only (plain `.ts` server code is not UI).
    files: ["src/**/*.tsx"],
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          "should-validate-template": true,
          "jsx-attributes": {
            exclude: [
              "className",
              "styleName",
              "style",
              "type",
              "key",
              "id",
              "role",
              "href",
              "src",
              "htmlFor",
              "name",
              "value",
              "placeholder",
              "aria-hidden",
              "aria-labelledby",
              "aria-describedby",
              "data-view-type",
              /^data-.*/,
            ],
          },
          words: {
            exclude: [
              DETECT_CSS_REGEX,
              DETECT_CSS_REGEX_2,
              DETECT_CSS_REGEX_3,
              DETECT_PX_REGEX,
              DETECT_REM_REGEX,
              DETECT_EM_REGEX,
              DETECT_COLOR_REGEX,
              "[0-9!-/:-@[-`{-~]+",
              "[A-Z_-]+",
              /^\p{Emoji}+$/u,
              "set-language",
              "set-state",
              "current-state",
            ],
          },
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "console",
              "error",
              "warn",
              "log",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
            ],
          },
        },
      ],
    },
  },
]
