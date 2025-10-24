"use client"

import { OverlayProvider } from "@react-aria/overlays"
import { QueryClientProvider } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import React, { useEffect, useState } from "react"
import { RouterProvider } from "react-aria-components"

import DialogProvider from "@/shared-module/common/components/dialogs/DialogProvider"
import { LoginStateContextProvider } from "@/shared-module/common/contexts/LoginStateContext"
import useLanguage, { DEFAULT_LANGUAGE, getDir } from "@/shared-module/common/hooks/useLanguage"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import GlobalStyles from "@/shared-module/common/styles/GlobalStyles"
import initI18n from "@/shared-module/common/utils/initI18n"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SERVICE_NAME = "main-frontend"

const i18n = initI18n(SERVICE_NAME)

interface ClientLayoutWrapperProps {
  children: React.ReactNode
}

function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  const router = useRouter()
  const initialLanguage = useLanguage()
  const [language, setLanguage] = useState(initialLanguage ?? DEFAULT_LANGUAGE)
  const [translationResourcesLoadedCounter, setTranslationResourcesLoadedCounter] = useState(0)

  useEffect(() => {
    // Remove the server-side injected CSS.
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

    console.info(`Setting language to: ${initialLanguage}`)
    i18n.changeLanguage(initialLanguage)
  }, [initialLanguage])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider navigate={(path) => router.push(path)}>
        <OverlayProvider>
          <DialogProvider>
            <GlobalStyles />
            <LoginStateContextProvider>{children}</LoginStateContextProvider>
          </DialogProvider>
        </OverlayProvider>
      </RouterProvider>
    </QueryClientProvider>
  )
}

export default withErrorBoundary(ClientLayoutWrapper)
