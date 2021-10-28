import { ThemeProvider } from "@material-ui/core"
import type { AppProps } from "next/app"
import Head from "next/head"
import React, { useEffect } from "react"
import { QueryClientProvider } from "react-query"
import { Provider } from "react-redux"

import useLanguage from "../shared-module/hooks/useLanguage"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import muiTheme from "../shared-module/styles/muiTheme"
import initI18n from "../shared-module/utils/initI18n"
import store from "../store/store"

// eslint-disable-next-line i18next/no-literal-string
const i18n = initI18n("quizzes")

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
    <>
      {language && (
        <Head>
          <html lang={language} />
        </Head>
      )}
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={muiTheme}>
            <GlobalStyles />
            <Component {...pageProps} />
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </>
  )
}

export default MyApp
