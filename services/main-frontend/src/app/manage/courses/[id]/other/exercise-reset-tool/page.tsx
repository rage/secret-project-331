"use client"

import { useParams } from "next/navigation"
import React from "react"

import ResetExercises from "@/components/page-specific/manage/courses/id/reset-exercises-tool/ResetExercises"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function OtherExerciseResetToolPage() {
  const params = useParams<{ id: string }>()
  return <ResetExercises courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherExerciseResetToolPage))
