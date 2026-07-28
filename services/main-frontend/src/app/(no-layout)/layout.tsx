"use client"

import React from "react"

import Layout from "@/components/Layout"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const NoLayoutLayout = ({
  children,
  params: _params,
}: {
  children: React.ReactNode
  params: Promise<Record<string, string | string[]>>
}) => {
  return <Layout noVisibleLayout>{children}</Layout>
}

export default withErrorBoundary(NoLayoutLayout)
