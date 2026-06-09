"use client"

import { OverlayProvider } from "@react-aria/overlays"
import { QueryClientProvider } from "@tanstack/react-query"
import React, { useEffect } from "react"

import { queryClient } from "@/shared-module/common/services/appQueryClient"
import initI18n from "@/shared-module/common/utils/initI18n"
import GlobalStyles from "@/shared-module/exercise-plugins/react/components/GlobalStyles"
import withErrorBoundary from "@/shared-module/exercise-plugins/react/components/withErrorBoundary"
import useLanguage from "@/shared-module/exercise-plugins/react/hooks/useLanguage"

const SERVICE_NAME = "tmc"

const i18n = initI18n(SERVICE_NAME)

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
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
    // Mirror previous behavior of setting the <html> lang attribute
    document.documentElement.lang = language
  }, [language])

  return (
    <QueryClientProvider client={queryClient}>
      <OverlayProvider>
        <GlobalStyles />
        {children}
      </OverlayProvider>
    </QueryClientProvider>
  )
}

export default withErrorBoundary(ClientLayoutWrapper)
