import { ThemeProvider } from "@material-ui/styles"
import type { AppProps } from "next/app"
import React from "react"
import { QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { RecoilRoot } from "recoil"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/styles/muiTheme"

import "../styles/Gutenberg/style.scss"

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
      <RecoilRoot>
        <ThemeProvider theme={muiTheme}>
          {/* <Devtools /> */}
          <GlobalStyles />
          <LoginStateContextProvider>
            <Component {...pageProps} />
          </LoginStateContextProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </RecoilRoot>
    </QueryClientProvider>
  )
}

export default MyApp
