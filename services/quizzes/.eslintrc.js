module.exports = {
  rules: {
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
          {
            name: "@material-ui/styles",
            importNames: ["withStyles"],
            message: "Don't use withStyles from @material-ui. Please use emotion.js.",
          },
          {
            name: "@material-ui/styles/withStyles",
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
