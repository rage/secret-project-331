import { createMuiTheme } from "@material-ui/core/styles"

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
