import { injectGlobal } from "@emotion/css"
import { config } from "@fortawesome/fontawesome-svg-core"
import type { AppProps } from "next/app"
import Head from "next/head"
import React, { useEffect } from "react"

import useLanguage from "../shared-module/hooks/useLanguage"
import GlobalStyles from "../shared-module/styles/GlobalStyles"
import initI18n from "../shared-module/utils/initI18n"

import "@fortawesome/fontawesome-svg-core/styles.css"
config.autoAddCss = false

injectGlobal`
html {
  overflow: hidden;
}
`

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
      <>
        <GlobalStyles />
        <Component {...pageProps} />
      </>
    </>
  )
}

export default MyApp
