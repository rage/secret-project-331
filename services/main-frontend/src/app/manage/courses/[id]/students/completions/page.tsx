"use client"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import { useStudentsContext } from "../StudentsContext"
import { CompletionsTabContent } from "../StudentsTableTabs"

function CompletionsPage() {
  const { courseId, searchQuery } = useStudentsContext()
  return <CompletionsTabContent courseId={courseId} searchQuery={searchQuery} />
}

export default withErrorBoundary(withSignedIn(CompletionsPage))
