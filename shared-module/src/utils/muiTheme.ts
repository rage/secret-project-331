import { createMuiTheme } from "@material-ui/core/styles"
import { Palette } from "@material-ui/core/styles/createPalette"
import { Typography, TypographyOptions } from "@material-ui/core/styles/createTypography"
import { ComponentsProps } from "@material-ui/core/styles/props"

declare module "@material-ui/core/styles" {
  interface Theme {
    typography: Typography
  }

  interface ThemeOptions {
    typography?: TypographyOptions | ((palette: Palette) => TypographyOptions) | undefined
    props?: ComponentsProps | undefined
  }
}

const muiTheme = createMuiTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
  props: {
    MuiButton: {
      variant: "outlined",
    },
  },
})

export default muiTheme
