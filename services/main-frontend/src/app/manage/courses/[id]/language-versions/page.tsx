"use client"

import { useParams } from "next/navigation"
import React from "react"

import CourseLanguageVersions from "./CourseLanguageVersions"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function LanguageVersionsPage() {
  const params = useParams<{ id: string }>()
  return <CourseLanguageVersions courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(LanguageVersionsPage))
