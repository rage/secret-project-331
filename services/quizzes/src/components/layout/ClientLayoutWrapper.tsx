import { injectGlobal } from "@emotion/css"
import { OverlayProvider } from "@react-aria/overlays"
import React, { useEffect } from "react"

import initI18n from "@/shared-module/common/utils/initI18n"
import GlobalStyles from "@/shared-module/exercise-react/react/components/GlobalStyles"
import withErrorBoundary from "@/shared-module/exercise-react/react/components/withErrorBoundary"
import useLanguage from "@/shared-module/exercise-react/react/hooks/useLanguage"

// oxlint-disable-next-line typescript/no-unused-expressions
injectGlobal`
html {
  overflow: hidden;
}
`

const SERVICE_NAME = "quizzes"

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
