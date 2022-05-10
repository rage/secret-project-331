import { config } from "@fortawesome/fontawesome-svg-core"
import { ThemeProvider } from "@mui/material"
import type { AppProps } from "next/app"
import React, { useEffect } from "react"
import { QueryClientProvider } from "react-query"

import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import useLanguage from "../shared-module/hooks/useLanguage"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/styles/muiTheme"
import generateWebVitalsReporter from "../shared-module/utils/generateWebVitalsReporter"
import initI18n from "../shared-module/utils/initI18n"

// Prevent rehydration mismatch by preloading english translations
import "../shared-module/locales/en/main-frontend.json"

import "@fortawesome/fontawesome-svg-core/styles.css"
config.autoAddCss = false
import "react-medium-image-zoom/dist/styles.css"

const SERVICE_NAME = "course-material"

const i18n = initI18n(SERVICE_NAME)

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  const language = useLanguage()

  useEffect(() => {
    // Remove the server-side injected CSS.
    // eslint-disable-next-line i18next/no-literal-string
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  useEffect(() => {
    if (!language) {
      return
    }

    // eslint-disable-next-line i18next/no-literal-string
    console.info(`Setting language to: ${language}`)
    i18n.changeLanguage(language)
  }, [language])

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

module.exports.reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default MyApp
