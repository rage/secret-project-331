"use client"

import { Suspense, useEffect } from "react"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"
import { installGlobalErrorReporting } from "@/shared-module/common/errors/installGlobalErrorReporting"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"
import Spinner from "@/shared-module/exercise-plugins/react/components/Spinner"

const SERVICE_NAME = "example-exercise"

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
