"use client"

import { useStudentsContext } from "../StudentsContext"
import { UserTabContent } from "../tabs/UserTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function UsersPage() {
  const { courseId, searchQuery } = useStudentsContext()
  return <UserTabContent courseId={courseId} searchQuery={searchQuery} />
}

export default withErrorBoundary(withSignedIn(UsersPage))
