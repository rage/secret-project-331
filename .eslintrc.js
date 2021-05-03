module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    "plugin:react-hooks/recommended",
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
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
  plugins: ["react", "@typescript-eslint", "eslint-custom-rules"],
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
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@material-ui/core",
            importNames: ["Grid"],
            message: "Don't use Grid from @material-ui. Please use either css flexbox or css grid.",
          },
          {
            name: "@material-ui/core/Grid",
            importNames: ["default"],
            message: "Don't use Grid from @material-ui. Please use either css flexbox or css grid.",
          },
          {
            name: "@material-ui/core",
            importNames: ["Typography"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
          },
          {
            name: "@material-ui/core/Typography",
            importNames: ["default"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
          },
        ],
      },
    ],
    "eslint-custom-rules/ban-ts-ignore-without-comment": "error",
    "eslint-custom-rules/no-material-ui-grid-component": "error",
  },
}
