"use client"

import { useParams } from "next/navigation"

import CourseGlossary from "./CourseGlossary"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OtherGlossaryPage() {
  const params = useParams<{ id: string }>()
  return <CourseGlossary courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherGlossaryPage))
