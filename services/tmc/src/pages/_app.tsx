import { QueryClientProvider } from "@tanstack/react-query"
import type { AppProps } from "next/app"
import React, { useEffect, useState } from "react"

import useLanguage from "../shared-module/hooks/useLanguage"
import { queryClient } from "../shared-module/services/appQueryClient"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import generateWebVitalsReporter from "../shared-module/utils/generateWebVitalsReporter"
import initI18n from "../shared-module/utils/initI18n"

const SERVICE_NAME = "tmc"

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
      <QueryClientProvider client={queryClient}>
        <GlobalStyles />
        <div key={`${language}${translationResourcesLoadedCounter}`}>
          <Component {...pageProps} />
        </div>
      </QueryClientProvider>
    </>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default MyApp
