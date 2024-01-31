/* eslint-disable i18next/no-literal-string */

const DETECT_CSS_REGEX = /\S+:\s+[^\n]+;/
const DETECT_PX_REGEX = /^\d+px$/
const DETECT_REM_REGEX = /^\d+rem$/
const DETECT_EM_REGEX = /^\d+em$/
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "plugin:@next/next/recommended",
    "plugin:@tanstack/eslint-plugin-query/recommended",
    "plugin:i18next/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:react-hooks/recommended",
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "@tanstack/query", "import", "eslint-custom-rules"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // Should be investigated later
    "@next/next/no-img-element": "off",
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-unused-vars": "off",
    // unused vars are allowed if they start with an underscore
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
            message: 'Use this instead: import { css } from "@emotion/css"',
          },
          {
            name: "@tanstack/react-query",
            importNames: ["useMutation"],
            message:
              "Don't use useMutation from react-query. Please use useToastMutation from shared-module",
          },
        ],
      },
    ],
    "react/forbid-component-props": [
      "error",
      {
        forbid: [
          {
            propName: "style",
            message:
              "Use emotion.js instead of the style prop\nE.g. className={css`font-size: 28px;`}",
          },
        ],
      },
    ],
    "react/forbid-dom-props": [
      "error",
      {
        forbid: [
          {
            propName: "style",
            message:
              "Use emotion.js instead of the style prop\nE.g. className={css`font-size: 28px;`}",
          },
        ],
      },
    ],
    "@typescript-eslint/ban-ts-comment": "off",
    "sort-imports": [
      "error",
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
      },
    ],
    "import/order": [
      "error",
      {
        alphabetize: {
          order: "asc",
        },
        groups: [["builtin", "external"], "parent", "sibling", "index"],
        "newlines-between": "always",
      },
    ],
    // Shared module will have unresolved import.
    "import/no-unresolved": "off",
    "import/no-named-as-default": "off",
    "i18next/no-literal-string": [
      "error",
      {
        validateTemplate: true,
        // only add attributes here that are guranteed to never contain traslatable strings
        ignoreAttribute: [
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
        ],
        ignore: [DETECT_CSS_REGEX, DETECT_PX_REGEX, DETECT_REM_REGEX, DETECT_EM_REGEX],
        ignoreCallee: [
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
          "console.log",
          "console.error",
          "Error",
        ],
        ignoreProperty: ["type"],
      },
    ],
    curly: "error",
  },
  overrides: [
    {
      files: ["system-tests/**/*"],
      rules: {
        "i18next/no-literal-string": "off",
      },
    },
    {
      files: ["system-tests/src/**/*"],
      extends: ["plugin:playwright/playwright-test"],
      rules: {
        "playwright/no-focused-test": "off",
        "playwright/prefer-strict-equal": "error",
        "playwright/prefer-to-be": "error",
        "playwright/valid-expect": "off",
        "playwright/expect-expect": "off",
      },
    },
  ],
}
