import { createTheme } from "@material-ui/core/styles"

import { primaryFont } from "../utils/typography"

const muiTheme = createTheme({
  typography: {
    fontFamily: primaryFont,
  },
})

export default muiTheme
