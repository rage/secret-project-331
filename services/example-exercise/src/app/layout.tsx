"use client"

import { Suspense } from "react"

import Providers from "./providers"

import Spinner from "@/shared-module/common/components/Spinner"
import generateWebVitalsReporter from "@/shared-module/common/utils/generateWebVitalsReporter"

const SERVICE_NAME = "example-exercise"

export const reportWebVitals = generateWebVitalsReporter(SERVICE_NAME)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<Spinner />}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  )
}
