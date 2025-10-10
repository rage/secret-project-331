import React from "react"

import Providers from "./providers"

import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "tmc"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
