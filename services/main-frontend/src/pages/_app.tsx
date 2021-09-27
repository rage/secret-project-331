import { ThemeProvider } from "@material-ui/core"
import type { AppProps } from "next/app"
import { useRouter } from "next/router"
import React, { useEffect } from "react"
import { QueryClientProvider } from "react-query"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/styles/muiTheme"
import initI18n from "../shared-module/utils/initI18n"

// eslint-disable-next-line i18next/no-literal-string
const i18n = initI18n("main-frontend")

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const locale = router?.locale
  useEffect(() => {
    // Remove the server-side injected CSS.
    // eslint-disable-next-line i18next/no-literal-string
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  useEffect(() => {
    if (!locale) {
      return
    }
    // We init 18n here, because locale is available
    i18n.changeLanguage(locale)
  }, [locale])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={muiTheme}>
        <GlobalStyles />
        <LoginStateContextProvider>
          <Component {...pageProps} />
        </LoginStateContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default MyApp
