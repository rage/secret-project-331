"use client"

import { Suspense } from "react"

import Spinner from "@/components/Spinner"
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper"

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
