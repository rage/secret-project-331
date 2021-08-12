import { ThemeProvider } from "@material-ui/core/styles"
import type { AppProps } from "next/app"
import React from "react"
import { QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/utils/muiTheme"

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {/* <RecoilRoot> */}
      {/* <Devtools /> */}
      <ThemeProvider theme={muiTheme}>
        <GlobalStyles />
        <LoginStateContextProvider>
          <Component {...pageProps} />
        </LoginStateContextProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
      {/* </RecoilRoot> */}
    </QueryClientProvider>
  )
}

export default MyApp
