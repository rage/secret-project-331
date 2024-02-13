import { QueryClientProvider } from "@tanstack/react-query"
import type { AppProps } from "next/app"
import Script from "next/script"
import React, { useEffect, useState } from "react"

import Layout from "../components/Layout"
import { LoginStateContextProvider } from "../shared-module/contexts/LoginStateContext"
import useLanguage from "../shared-module/hooks/useLanguage"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "../shared-module/utils/constants"
import generateWebVitalsReporter from "../shared-module/utils/generateWebVitalsReporter"
import initI18n from "../shared-module/utils/initI18n"
import "../styles/Gutenberg/style.scss"
import LocalStyles from "../styles/LocalStyles"

const SERVICE_NAME = "cms"

const i18n = initI18n(SERVICE_NAME)

const MyApp: React.FC<React.PropsWithChildren<AppProps>> = ({ Component, pageProps }) => {
  const initialLanguage = useLanguage()
  const [language, setLanguage] = useState(initialLanguage ?? "en")
  const [translationResourcesLoadedCounter, setTranslationResourcesLoadedCounter] = useState(0)

  useEffect(() => {
    // Remove the server-side injected CSS.
    // eslint-disable-next-line i18next/no-literal-string
    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  useEffect(() => {
    i18n.on("languageChanged", (language) => {
      const htmlElement = document.querySelector("html")
      if (!htmlElement) {
        return
      }
      htmlElement.setAttribute("lang", language)
      setLanguage(language)
    })
    i18n.on("loaded", () => {
      setTranslationResourcesLoadedCounter((counter) => counter + 1)
    })
    return () => {
      i18n.off("languageChanged")
      i18n.off("loaded")
    }
  }, [])

  useEffect(() => {
    if (!initialLanguage) {
      return
    }

    // eslint-disable-next-line i18next/no-literal-string
    console.info(`Setting language to: ${initialLanguage}`)
    i18n.changeLanguage(initialLanguage)
  }, [initialLanguage])

  return (
    <>
      <Script noModule id="outdated-browser-warning">
        {OUTDATED_BROWSER_WARNING_SCRIPT}
      </Script>

      <QueryClientProvider client={queryClient}>
        <GlobalStyles />
        <LocalStyles />
        <LoginStateContextProvider>
          <Layout
            key={`${language}${translationResourcesLoadedCounter}`}
            /* @ts-expect-error: hideBreadcrumbs is an addtional property on Component */
            hideBreadcrumbs={Component.hideBreadcrumbs}
          >
            <Component {...pageProps} />
          </Layout>
        </LoginStateContextProvider>
      </QueryClientProvider>
    </>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default MyApp
