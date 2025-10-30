"use client"

import React from "react"

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
    <div>
      <h1>This is the course material layout</h1>
      <>{children}</>
    </div>
  )
}

export default withErrorBoundary(CourseMaterialLayout)
