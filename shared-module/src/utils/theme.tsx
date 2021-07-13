import { blue, green, neutral, red, yellow } from "./colors"
import { primaryFont } from "./typography"

export const theme = {
  primaryColor: blue[300],
  primaryHoverColor: blue[200],
  primaryActiveColor: blue[100],
  textColorOnPrimary: neutral[100],
  textColor: neutral[600],
  textColorInvented: neutral[100],
  disabled: neutral[400],
  textOnDisabled: neutral[300],
  formElementBackground: neutral[100],
  textOnFormElementBackground: neutral[600],
  primaryFont,
  status: {
    warningColor: yellow[100],
    warningColorHover: yellow[200],
    warningColorActive: yellow[300],
    errorColor: red[100],
    errorColorHover: red[200],
    errorColorActive: red[300],
    successColor: green[100],
    successColorHover: green[200],
    successColorActive: green[300],
  },
}
