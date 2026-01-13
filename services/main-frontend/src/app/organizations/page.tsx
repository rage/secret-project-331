"use client"
import React from "react"

import OrganizationsList from "@/components/page-specific/organizations/index/OrganizationsList"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const OrganizationsPage: React.FC = () => {
  return (
    <>
      <OrganizationsList />
    </>
  )
}

export default withErrorBoundary(OrganizationsPage)
