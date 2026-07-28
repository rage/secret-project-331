"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseCheatersTabs from "../CourseCheatersTabs"

function CheatersDismissedPage() {
  const params = useParams<{ id: string }>()
  return <CourseCheatersTabs courseId={params.id} status="Dismissed" />
}

export default withErrorBoundary(withSignedIn(CheatersDismissedPage))
