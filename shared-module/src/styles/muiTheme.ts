import { createTheme } from "@material-ui/core"

export const theme = createTheme({
  typography: {
    fontFamily: "Lato",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: 'Lato';
          font-style: normal;
          font-display: swap;
          font-weight: 400;
          src: url('../../node_modules/@fontsource/lato/files/lato-latin-ext-400-normal.woff2') format('woff2'), url('../../node_modules/@fontsource/lato/files/lato-all-400-normal.woff') format('woff');
          unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
        }
      `,
    },
  },
})
