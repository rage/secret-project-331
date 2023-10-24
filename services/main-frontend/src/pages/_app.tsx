import { QueryClientProvider } from "@tanstack/react-query"
import type { AppProps } from "next/app"
import Head from "next/head"
import Script from "next/script"
import React, { useEffect } from "react"

import Layout from "../components/Layout"
import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import useLanguage from "../shared-module/hooks/useLanguage"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "../shared-module/utils/constants"
import generateWebVitalsReporter from "../shared-module/utils/generateWebVitalsReporter"
import initI18n from "../shared-module/utils/initI18n"

const SERVICE_NAME = "main-frontend"

const i18n = initI18n(SERVICE_NAME)

const MyApp: React.FC<React.PropsWithChildren<AppProps>> = ({ Component, pageProps }) => {
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
      <Script noModule id="outdated-browser-warning">
        {OUTDATED_BROWSER_WARNING_SCRIPT}
      </Script>
      {language && (
        <Head>
          <html lang={language} />
        </Head>
      )}
      <QueryClientProvider client={queryClient}>
        <GlobalStyles />
        <LoginStateContextProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </LoginStateContextProvider>
      </QueryClientProvider>
    </>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default MyApp
