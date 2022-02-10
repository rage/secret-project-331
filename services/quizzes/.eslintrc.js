/* eslint-disable i18next/no-literal-string */
module.exports = {
  rules: {
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
            importNames: ["Typography"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
          },
          {
            name: "@mui/material/Typography",
            importNames: ["default"],
            message: "Don't use Typography from @material-ui. Please use p, h1, h2, h3...",
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
            message: 'Use this instad: import { css } from "@emotion/css"',
          },
        ],
      },
    ],
  },
}
