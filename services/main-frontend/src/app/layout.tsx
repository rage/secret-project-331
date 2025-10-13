"use client"

export const dynamic = "force-dynamic"

import Script from "next/script"
import React, { Suspense } from "react"

import Providers from "./providers"

import Layout from "@/components/Layout"
import { getDir } from "@/shared-module/common/hooks/useLanguage"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "@/shared-module/common/utils/constants"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SERVICE_NAME = "main-frontend"

const RootLayout = ({
  children,
  params: _params,
}: {
  children: React.ReactNode
  params: Promise<Record<string, string | string[]>>
}) => {
  // @ts-expect-error: custom prop
  const noVisibleLayout = Boolean(children?.noVisibleLayout)
  return (
    <html lang="en" dir={getDir("en")}>
      <body>
        <Script noModule id="outdated-browser-warning">
          {OUTDATED_BROWSER_WARNING_SCRIPT}
        </Script>
        <Providers>
          <Suspense fallback={<div>Loading...</div>}>
            <Layout noVisibleLayout={noVisibleLayout}>{children}</Layout>
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default withErrorBoundary(RootLayout)
