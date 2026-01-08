"use client"

import React from "react"

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
    <>
      <CourseMaterialEffects />
      <Centered variant="narrow">{children}</Centered>
    </>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
