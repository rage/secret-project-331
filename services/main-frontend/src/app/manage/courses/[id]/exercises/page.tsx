"use client"

import { useParams } from "next/navigation"
import React from "react"

import CourseExercises from "@/components/page-specific/manage/courses/id/exercises/CourseExercises"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function ExercisesPage() {
  const params = useParams<{ id: string }>()
  return <CourseExercises courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(ExercisesPage))
