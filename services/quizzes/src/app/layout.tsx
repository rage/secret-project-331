export const dynamic = "force-dynamic"

import React, { Suspense } from "react"

import AppProviders from "./AppProviders"

import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "quizzes"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </AppProviders>
      </body>
    </html>
  )
}
