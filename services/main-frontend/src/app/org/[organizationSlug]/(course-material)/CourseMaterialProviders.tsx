"use client"

import { Provider } from "jotai"
import React from "react"

function CourseMaterialProviders({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}

export default CourseMaterialProviders
