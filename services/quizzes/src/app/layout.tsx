import React from "react"

import AppProviders from "./AppProviders"

import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "quizzes"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
