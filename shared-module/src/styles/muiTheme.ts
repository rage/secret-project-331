/* eslint-disable i18next/no-literal-string */
import { createTheme } from "@mui/material"

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
