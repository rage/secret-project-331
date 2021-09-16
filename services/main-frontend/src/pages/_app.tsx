import { ThemeProvider } from "@material-ui/core/styles"
import type { AppProps } from "next/app"
import { useRouter } from "next/router"
import React, { useEffect } from "react"
import { QueryClientProvider } from "react-query"
import { ReactQueryDevtools } from "react-query/devtools"
import { RecoilRoot } from "recoil"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/styles/muiTheme"
// import i18n from "../shared-module/utils/i18n"

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const locale = router?.locale
  useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  // useEffect(() => {
  //   if (!locale) {
  //     return
  //   }
  //   i18n.changeLanguage(locale)
  // }, [locale])

  console.group("-----------------------------------")
  console.log(JSON.stringify(pageProps))
  console.groupEnd()

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        {/* <Devtools /> */}
        <ThemeProvider theme={muiTheme}>
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
