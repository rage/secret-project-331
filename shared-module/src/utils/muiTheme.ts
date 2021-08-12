import { createTheme } from "@material-ui/core/styles"

import { headingFont } from "./typography"

const muiTheme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
    fontFamily: headingFont,
  },
})

export default muiTheme
