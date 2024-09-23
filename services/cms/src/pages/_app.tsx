import { QueryClientProvider } from "@tanstack/react-query"
import type { AppProps } from "next/app"
import Script from "next/script"
import React, { useEffect, useState } from "react"

import Layout from "../components/Layout"
import LocalStyles from "../styles/LocalStyles"

import { LoginStateContextProvider } from "@/shared-module/common/contexts/LoginStateContext"
import useLanguage, { getDir } from "@/shared-module/common/hooks/useLanguage"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import GlobalStyles from "@/shared-module/common/styles/GlobalStyles"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "@/shared-module/common/utils/constants"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"
import initI18n from "@/shared-module/common/utils/initI18n"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

import "../styles/Gutenberg/style.scss"

const SERVICE_NAME = "cms"

const i18n = initI18n(SERVICE_NAME)

const MyApp: React.FC<React.PropsWithChildren<AppProps>> = ({ Component, pageProps }) => {
  const initialLanguage = useLanguage()
  // eslint-disable-next-line i18next/no-literal-string
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
      console.info(`i18n language changed to: ${language}`)
      const htmlElement = document.querySelector("html")
      if (!htmlElement) {
        return
      }
      htmlElement.setAttribute("lang", language)
      htmlElement.setAttribute("dir", getDir(language))
      setLanguage(language)
    })
    i18n.on("loaded", () => {
      // Updating the counter forces the  whole app to re-render
      // As this this counter does not change the ui, the re-render will affect the interface other than react rendering
      // components again and then decieding that there's not much need to update the ui
      setTranslationResourcesLoadedCounter((counter) => counter + 1)
    })
    return () => {
      i18n.off("languageChanged")
      i18n.off("loaded")
    }
  }, [])

  // Make sure variables are used, doesn't do anything now, but will make sure the variable won't be optimized out in the future.
  assertNotNullOrUndefined(translationResourcesLoadedCounter)
  assertNotNullOrUndefined(language)

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
