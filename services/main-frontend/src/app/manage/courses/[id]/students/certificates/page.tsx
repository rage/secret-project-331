"use client"

import React from "react"

import { useStudentsContext } from "../StudentsContext"
import { CertificatesTabContent } from "../StudentsTableTabs"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CertificatesPage() {
  const { courseId, searchQuery } = useStudentsContext()
  return <CertificatesTabContent courseId={courseId} searchQuery={searchQuery} />
}

export default withErrorBoundary(withSignedIn(CertificatesPage))
