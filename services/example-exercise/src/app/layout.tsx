"use client"

import { Suspense } from "react"

import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"
import Spinner from "@/shared-module/exercise-react/react/components/Spinner"

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
