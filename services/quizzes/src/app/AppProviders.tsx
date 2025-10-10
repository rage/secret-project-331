"use client"

import { injectGlobal } from "@emotion/css"
import { OverlayProvider } from "@react-aria/overlays"
import React, { useEffect } from "react"

import useLanguage from "@/shared-module/common/hooks/useLanguage"
import GlobalStyles from "@/shared-module/common/styles/GlobalStyles"
import initI18n from "@/shared-module/common/utils/initI18n"

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
injectGlobal`
html {
  overflow: hidden;
}
`

const SERVICE_NAME = "quizzes"

const i18n = initI18n(SERVICE_NAME)

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const language = useLanguage()

  useEffect(() => {
    // Remove the server-side injected CSS.

    const jssStyles = document.querySelector("#jss-server-side")
    if (jssStyles) {
      jssStyles.parentElement?.removeChild(jssStyles)
    }
  }, [])

  useEffect(() => {
    if (!language) {
      return
    }

    console.info(`Setting language to: ${language}`)
    i18n.changeLanguage(language)
    document.documentElement.lang = language
  }, [language])

  return (
    <OverlayProvider>
      <GlobalStyles />
      {children}
    </OverlayProvider>
  )
}
