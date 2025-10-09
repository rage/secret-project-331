"use client"
import Script from "next/script"
import React from "react"

import Providers from "./providers"

import Layout from "@/components/Layout"
import { getDir } from "@/shared-module/common/hooks/useLanguage"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "@/shared-module/common/utils/constants"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SERVICE_NAME = "main-frontend"

const RootLayout = ({
  children,
}: {
  children: React.ReactNode & { noVisibleLayout?: boolean }
}) => {
  return (
    <html lang="en" dir={getDir("en")}>
      <body>
        <Script noModule id="outdated-browser-warning">
          {OUTDATED_BROWSER_WARNING_SCRIPT}
        </Script>
        <Providers>
          <Layout noVisibleLayout={Boolean(children?.noVisibleLayout)}>{children}</Layout>
        </Providers>
      </body>
    </html>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default withErrorBoundary(RootLayout)
