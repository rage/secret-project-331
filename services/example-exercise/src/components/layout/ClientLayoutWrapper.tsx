"use client"

import { OverlayProvider } from "@react-aria/overlays"
import React, { useEffect } from "react"

import initI18n from "@/i18n/initI18n"
import withErrorBoundary from "@/lib/withErrorBoundary"
import useLanguage from "@/shared-module/exercise-plugins/react/hooks/useLanguage"
import GlobalStyles from "@/styles/GlobalStyles"

const SERVICE_NAME = "example-exercise"

const i18n = initI18n(SERVICE_NAME)

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const language = useLanguage()

  useEffect(() => {
    if (!language) {
      return
    }
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

export default withErrorBoundary(ClientLayoutWrapper)
