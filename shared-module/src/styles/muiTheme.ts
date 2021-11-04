/* eslint-disable i18next/no-literal-string */
import { createTheme } from "@material-ui/core"

import { primaryFont } from "./typography"

const muiTheme = createTheme({
  typography: {
    fontFamily: primaryFont,
    button: {
      textTransform: "none",
    },
  },
})

export default muiTheme
