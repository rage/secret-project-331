"use client"

import React from "react"

import { useStudentsContext } from "../StudentsContext"
import { CompletionsTabContent } from "../StudentsTableTabs"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CompletionsPage() {
  const { courseId, searchQuery } = useStudentsContext()
  return <CompletionsTabContent courseId={courseId} searchQuery={searchQuery} />
}

export default withErrorBoundary(withSignedIn(CompletionsPage))
