"use client"

import { useParams } from "next/navigation"
import React from "react"

import CoursePages from "./CoursePages"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function PagesPage() {
  const params = useParams<{ id: string }>()
  return <CoursePages courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(PagesPage))
