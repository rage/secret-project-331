"use client"

import { useParams } from "next/navigation"
import React from "react"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CompletionRegistrationPage from "./CompletionRegistrationPage"

const CompletionPage: React.FC = () => {
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  return <CompletionRegistrationPage courseModuleId={courseModuleId} />
}

export default withErrorBoundary(withSignedIn(CompletionPage))
