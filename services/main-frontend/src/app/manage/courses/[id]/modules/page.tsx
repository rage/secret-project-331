"use client"

import { useParams } from "next/navigation"
import React from "react"

import CourseModules from "../pages/CourseModules"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function ModulesPage() {
  const params = useParams<{ id: string }>()
  return <CourseModules courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(ModulesPage))
