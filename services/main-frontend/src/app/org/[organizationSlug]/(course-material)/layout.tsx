"use client"

import React from "react"

import CourseMaterialProviders from "./CourseMaterialProviders"

import Centered from "@/shared-module/common/components/Centering/Centered"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CourseMaterialLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Suppress unused params warning
  void params

  return (
    <CourseMaterialProviders>
      <Centered variant="narrow">{children}</Centered>
    </CourseMaterialProviders>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
