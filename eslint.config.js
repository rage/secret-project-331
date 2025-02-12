import js from "@eslint/js"
import next from "@next/eslint-plugin-next"
import tanstackQuery from "@tanstack/eslint-plugin-query"
import typescriptEslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import i18next from "eslint-plugin-i18next"
import importPlugin from "eslint-plugin-import"
import jsxA11y from "eslint-plugin-jsx-a11y"
import playwright from "eslint-plugin-playwright"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

const DETECT_CSS_REGEX = /:.*;/
const DETECT_CSS_REGEX_2 = /!important/
const DETECT_CSS_REGEX_3 = /;.*:/s
const DETECT_PX_REGEX = /^\d+px$/
const DETECT_REM_REGEX = /^\d+rem$/
const DETECT_EM_REGEX = /^\d+em$/
const DETECT_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const DETECT_STYLE_PROP =
  /^(height|width|transform|transition|background|color|margin|padding|border|display|position|top|bottom|left|right|z-index|font-size|font-weight|line-height|cursor|content|clip-path|appearance|gap|grid-template-columns|place-content|box-shadow|border-radius|transition-property|transition-duration|transition-timing-function|fill):/
const DETECT_BEZIER = /cubic-bezier\([^)]+\)/
const DETECT_TRANSFORM = /translate(Y|3d)|rotate|scale/

/** Helper function to clean object keys of whitespace */
const cleanGlobals = (globalsObj) =>
  Object.fromEntries(Object.entries(globalsObj).map(([key, value]) => [key.trim(), value]))

const baseIgnorePatterns = [
  "**/node_modules/**",
  "**/target/**",
  "**/.next/**",
  "**/out/**",
  "**/playwright-report/**",
  "**/storybook-static/**",
  "**/services/main-frontend/public/monaco-editor/**",
  "**/.venv/**",
  "**/generated-docs/**",
]

const getIgnorePatterns = (prefix = "") =>
  prefix ? baseIgnorePatterns.map((pattern) => `${prefix}${pattern}`) : baseIgnorePatterns

const config = [
  {
    ignores: [
      ...getIgnorePatterns(),
      // Ignore copies of shared module
      "**/shared-module/**",
      // Don't ignore the root shared module
      "!shared-module/**",
      // But do ignore build/output dirs inside root shared module
      ...getIgnorePatterns("shared-module/"),
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": next,
    },
    rules: {
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-img-element": "error",
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-script-component-in-head": "error",
      "@next/next/google-font-display": "error",
      "@next/next/google-font-preconnect": "error",
      "@next/next/next-script-for-ga": "error",
      "@next/next/no-head-element": "error",
      "@next/next/no-page-custom-font": "error",
      "@next/next/no-styled-jsx-in-document": "error",
      "@next/next/no-title-in-document-head": "error",
      "@next/next/no-typos": "error",
      "@next/next/no-unwanted-polyfillio": "error",
    },
  },
  ...tanstackQuery.configs["flat/recommended"],
  i18next.configs["flat/recommended"],
  jsxA11y.flatConfigs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  importPlugin.flatConfigs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // Disable import checking rules
      "import/no-unresolved": "off",
      "import/named": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/export": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        project: false,
        tsconfigRootDir: import.meta.dirname,
        jsDocParsingMode: "all",
        warnOnUnsupportedTypeScriptVersion: true,
      },
      globals: {
        ...cleanGlobals(globals.browser),
        ...cleanGlobals(globals.node),
        React: true,
        NodeJS: true,
        JSX: true,
        WindowEventMap: true,
        RequestInit: true,
      },
    },
    settings: {
      react: {
        version: "19",
        componentWrapperFunctions: [
          { property: "styled" },
          { property: "css" },
          { property: "sx" },
          "styled",
        ],
        formComponents: [],
        linkComponents: [],
      },
      "jsx-a11y": {
        components: {
          Button: "button",
        },
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,

      "@next/next/no-img-element": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@emotion/react",
              importNames: ["css"],
              message: 'Use "@emotion/css" instead.',
            },
          ],
        },
      ],
      "react/forbid-component-props": [
        "error",
        { forbid: [{ propName: "style", message: "Use emotion.js instead." }] },
      ],
      "react/forbid-dom-props": [
        "error",
        { forbid: [{ propName: "style", message: "Use emotion.js instead." }] },
      ],
      "sort-imports": ["error", { ignoreCase: true, ignoreDeclarationSort: true }],
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc" },
          groups: [["builtin", "external"], "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
      curly: "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          additionalHooks: "(useMyCustomHook|useMyOtherCustomHook)",
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          message: "Untranslated string",
          "should-validate-template": true,
          "jsx-components": {
            exclude: ["Trans"],
          },
          "jsx-attributes": {
            exclude: [
              "className",
              "styleName",
              "style",
              "type",
              "key",
              "id",
              "width",
              "height",
              "variant",
              "size",
              "href",
              "severity",
              "navVariant",
              "aria-labelledby",
              "aria-describedby",
              "aria-live",
              "url",
              "labelId",
              "defaultLanguage",
              "color",
              "labelPlacement",
              "role",
              "aria-hidden",
              "aria-errormessage",
              "aria-invalid",
              "maxWidth",
              "transform",
              "viewBox",
              "testPlaceholder",
              "sidebarPosition",
              "buttonSize",
              "labelStyle",
              "data-testid",
              "weight",
              "action",
              "tagName",
              "templateLock",
              /^data-.*/,
              "htmlFor",
              "src",
              "ref",
              "buttonId",
              "target",
              "rel",
              "autoComplete",
              "value",
              "defaultValue",
              "maxHeight",
              "loading",
              "fetchpriority",
              "sx",
              "component",
              "align",
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
              DETECT_STYLE_PROP,
              DETECT_BEZIER,
              DETECT_TRANSFORM,
              "[0-9!-/:-@[-`{-~]+",
              "[A-Z_-]+",
              /^\p{Emoji}+$/u,
              "set-language",
              "set-state",
              "main-navigation-menu",
              "Component",
            ],
          },
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "getElementById",
              "dispatch",
              "commit",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
              "div",
              "useQuery",
              "useQueryParameter",
              "get",
              "post",
              "put",
              "delete",
              "create",
              "styled",
              "css",
              "register",
              "setValue",
              "getValues",
              "watch",
              "useMediaQuery",
              "log",
              "groupCollapsed",
              "error",
              "warn",
              "info",
              "group",
              "Error",
              "querySelector",
              "usePopper",
              "i18n.on",
              "i18n.off",
              "createElement",
              "localStorage.setItem",
              "localStorage.getItem",
              "differenceBy",
              "accessor",
              "useTranslation",
              "sortBy",
              "split",
              "JSON.parse",
              "addFilter",
              "removeFilter",
              "setError",
              "clearErrors",
              "URL",
              "setTimeout",
              "setInterval",
              "clearTimeout",
              "clearInterval",
              "fetch",
              "requestAnimationFrame",
              "document.cookie",
              "document.querySelectorAll",
              "setAttribute",
              "innerHTML",
              "setActive",
              "window.open",
              "window.location.replace",
              "window.location.href",
              "window.location.assign",
              "window.history.pushState",
              "setFormError",
              "animated",
            ],
          },
          "object-properties": {
            exclude: ["type", "[A-Z_-]+", "displayName", "href", "direction"],
          },
          "class-properties": {
            exclude: ["displayName"],
          },
        },
      ],
    },
  },
  {
    files: [
      "system-tests/**/*",
      "**/*.test.tsx",
      "**/*.test.ts",
      "storybook/**/*",
      "shared-module/packages/create-exercise-service/**/*",
    ],
    rules: { "i18next/no-literal-string": "off" },
  },
  {
    files: ["system-tests/src/**/*"],
    ...playwright.configs["flat/recommended"],
    languageOptions: {
      globals: {
        // Test globals
        test: true,
        expect: true,
        describe: true,
        it: true,
        jest: true,
        beforeAll: true,
        afterAll: true,
        beforeEach: true,
        afterEach: true,
        // Node.js globals
        Buffer: true,
        BufferEncoding: true,
      },
    },
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      // Override specific Playwright rules
      "playwright/no-focused-test": "off",
      "playwright/prefer-strict-equal": "error",
      "playwright/prefer-to-be": "error",
      "playwright/valid-expect": "off",
      "playwright/expect-expect": "off",
      "playwright/no-standalone-expect": "off",
    },
  },
  {
    files: ["**/*.test.*", "**/tests/**/*"],
    languageOptions: {
      globals: {
        // Test globals
        test: true,
        expect: true,
        describe: true,
        it: true,
        jest: true,
        beforeAll: true,
        afterAll: true,
        beforeEach: true,
        afterEach: true,
        // Node.js globals
        Buffer: true,
        BufferEncoding: true,
      },
    },
  },
  eslintPluginPrettierRecommended,
]

export default config
