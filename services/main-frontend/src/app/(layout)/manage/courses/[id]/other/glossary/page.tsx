"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseGlossary from "./CourseGlossary"

function OtherGlossaryPage() {
  const params = useParams<{ id: string }>()
  return <CourseGlossary courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherGlossaryPage))
