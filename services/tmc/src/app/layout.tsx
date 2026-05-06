"use client"

import React, { Suspense, useEffect } from "react"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"
import Spinner from "@/shared-module/common/components/Spinner"
import { installGlobalErrorReporting } from "@/shared-module/common/errors/installGlobalErrorReporting"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "tmc"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installGlobalErrorReporting({ service: SERVICE_NAME })
  }, [])

  return (
    <html lang="en">
      <body>
        <Suspense fallback={<Spinner />}>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </Suspense>
      </body>
    </html>
  )
}
