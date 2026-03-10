"use client"

import { useStudentsContext } from "../StudentsContext"
import { ProgressTabContent } from "../tabs/ProgressTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function ProgressPage() {
  const { courseId, searchQuery } = useStudentsContext()
  return <ProgressTabContent courseId={courseId} searchQuery={searchQuery} />
}

export default withErrorBoundary(withSignedIn(ProgressPage))
