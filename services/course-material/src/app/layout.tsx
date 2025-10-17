"use client"

import Script from "next/script"
import React, { Suspense } from "react"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"
import Layout from "@/components/layout/Layout"
import Spinner from "@/shared-module/common/components/Spinner"
import { OUTDATED_BROWSER_WARNING_SCRIPT } from "@/shared-module/common/utils/constants"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import "react-medium-image-zoom/dist/styles.css"

const SERVICE_NAME = "course-material"

function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Suppress unused params warning
  void params

  return (
    <html lang="en">
      <body>
        <Script noModule id="outdated-browser-warning">
          {OUTDATED_BROWSER_WARNING_SCRIPT}
        </Script>

        <Suspense fallback={<Spinner />}>
          <ClientLayoutWrapper>
            <Suspense fallback={<Spinner />}>
              <Layout>{children}</Layout>
            </Suspense>
          </ClientLayoutWrapper>
        </Suspense>
      </body>
    </html>
  )
}

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default withErrorBoundary(RootLayout)
