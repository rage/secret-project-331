import js from "@eslint/js"
import next from "@next/eslint-plugin-next"
import tanstackQuery from "@tanstack/eslint-plugin-query"
import typescriptEslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import { FlatCompat } from '@eslint/eslintrc'
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

/** Helper function to clean object keys of whitespace */
const cleanGlobals = (globalsObj) =>
  Object.fromEntries(Object.entries(globalsObj).map(([key, value]) => [key.trim(), value]))

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
})

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/target/**",
      "**/.next/**",
      "**/out/**",
      "**/playwright-report/**",
      "**/storybook-static/**",
      // Ignore copies of shared module
      "**/shared-module/**",
      // Don't ignore the shared module in the root
      "!shared-module/**",
      "**/services/main-frontend/public/monaco-editor/**",
      "**/.venv/**",
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
  }),
  ...tanstackQuery.configs['flat/recommended'],
  i18next.configs['flat/recommended'],
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  jsxA11y.flatConfigs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['flat/recommended'],
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        },
        project: true, // Find nearest tsconfig.json for each source file
        tsconfigRootDir: import.meta.dirname,
        jsDocParsingMode: 'all',
        warnOnUnsupportedTypeScriptVersion: true
      },
      globals: {
        ...cleanGlobals(globals.browser),
        ...cleanGlobals(globals.node),
        React: true,
        NodeJS: true,
        JSX: true,
        WindowEventMap: true,
      },
    },
    settings: {
      react: {
        version: "detect",
        componentWrapperFunctions: [
          { property: "styled" },
          { property: "css" },
          { property: "sx" },
          "styled",
        ],
        formComponents: [],
        linkComponents: [],
      },
      'import/resolver': {
        typescript: true,
        node: true
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
      },
      'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
      'jsx-a11y': {
        components: {
          Button: 'button',
        }
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: importPlugin,
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
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/namespace": "error",
      "import/default": "error",
      "import/export": "error",
      "import/no-named-as-default": "off",
      curly: "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": ["warn", {
        "additionalHooks": "(useMyCustomHook|useMyOtherCustomHook)"
      }],
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "import/no-named-as-default": "off",
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          message: "Untranslated string",
          "should-validate-template": true,
          // only add attributes here that are guranteed to never contain traslatable strings
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
              "url",
              "labelId",
              "defaultLanguage",
              "color",
              "labelPlacement",
              "role",
              "aria-hidden",
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
            ],
          },
          "object-properties": {
            exclude: ["type", "[A-Z_-]+", "displayName"],
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
    files: ["system-tests/src/**/*", "**/*.test.*"],
    ...playwright.configs['flat/recommended'],
    languageOptions: {
      globals: {
        test: true,
        expect: true,
        describe: true,
        it: true,
      }
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Override specific Playwright rules
      "playwright/no-focused-test": "off",
      "playwright/prefer-strict-equal": "error",
      "playwright/prefer-to-be": "error",
      "playwright/valid-expect": "off",
      "playwright/expect-expect": "off",
      "playwright/no-standalone-expect": "off",
    },
  },
  eslintPluginPrettierRecommended,
]
