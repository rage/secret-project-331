"use client"

import React, { Suspense } from "react"

import AppProviders from "./AppProviders"

import Spinner from "@/shared-module/common/components/Spinner"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "quizzes"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<Spinner />}>
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  )
}
