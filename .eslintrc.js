/* eslint-disable i18next/no-literal-string */

const DETECT_CSS_REGEX = /\S+:\s+[^\n]+;/
const DETECT_PX_REGEX = /^\d+px$/
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
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
  plugins: ["react", "@typescript-eslint", "import", "eslint-custom-rules"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
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
            name: "@mui/material",
            importNames: ["Grid"],
            message: "Don't use Grid from @material-ui. Please use either css flexbox or css grid.",
          },
          {
            name: "@mui/material/Grid",
            importNames: ["default"],
            message: "Don't use Grid from @material-ui. Please use either css flexbox or css grid.",
          },
          {
            name: "@mui/material",
            importNames: ["Container"],
            message:
              "Don't use Container from @material-ui. Please use Centered from shared-module.",
          },
          {
            name: "@mui/material/Container",
            importNames: ["default"],
            message:
              "Don't use Container from @material-ui. Please use Centered from shared-module.",
          },
          {
            name: "@mui/material",
            importNames: ["Typography"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
          },
          {
            name: "@mui/material/Typography",
            importNames: ["default"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
          },
          {
            name: "@mui/material",
            importNames: ["Button"],
            message: "Don't use Button from @material-ui. Please use Button from shared-module.",
          },
          {
            name: "@mui/material/Button",
            importNames: ["default"],
            message: "Don't use Button from @material-ui. Please use Button from shared-module.",
          },
          {
            name: "@mui/material/Pagination",
            importNames: ["default"],
            message:
              "Don't use Pagination from @material-ui. Please use Pagination from shared-module.",
          },
          {
            name: "@mui/material",
            importNames: ["Pagination"],
            message:
              "Don't use Pagination from @material-ui. Please use Pagination from shared-module.",
          },
          {
            name: "@mui/material/Box",
            importNames: ["default"],
            message: "Don't use Box from @material-ui. Please use a div.",
          },
          {
            name: "@mui/material",
            importNames: ["Box"],
            message: "Don't use Box from @material-ui. Please use a div.",
          },
          {
            name: "@mui/styles",
            importNames: ["withStyles"],
            message: "Don't use withStyles from @material-ui. Please use emotion.js.",
          },
          {
            name: "@mui/styles/withStyles",
            importNames: ["default"],
            message: "Don't use withStyles from @material-ui. Please use emotion.js.",
          },
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
    "eslint-custom-rules/ban-ts-ignore-without-comment": "error",
    "eslint-custom-rules/no-material-ui-grid-component": "error",
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
        ],
        ignore: [DETECT_CSS_REGEX, DETECT_PX_REGEX],
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
  ],
}
