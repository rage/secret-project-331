import { createTheme } from "@material-ui/core/styles"

import { primaryFont } from "./typography"

const muiTheme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
    fontFamily: primaryFont,
  },
})

export default muiTheme
