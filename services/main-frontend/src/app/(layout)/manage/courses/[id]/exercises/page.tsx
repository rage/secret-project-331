"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseExercises from "./CourseExercises"

function ExercisesPage() {
  const params = useParams<{ id: string }>()
  return <CourseExercises courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(ExercisesPage))
