"use client"

import React from "react"

import CourseMaterialProviders from "./CourseMaterialProviders"

import CourseMaterialEffects from "@/components/course-material/CourseMaterialEffects"
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
      <CourseMaterialEffects />
      <Centered variant="narrow">{children}</Centered>
    </CourseMaterialProviders>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
