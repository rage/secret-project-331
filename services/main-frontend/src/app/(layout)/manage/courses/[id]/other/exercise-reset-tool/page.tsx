"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import ResetExercises from "./ResetExercises"

function OtherExerciseResetToolPage() {
  const params = useParams<{ id: string }>()
  return <ResetExercises courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(OtherExerciseResetToolPage))
