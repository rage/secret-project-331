"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseCheatersTabs from "../CourseCheatersTabs"

function CheatersSuspectedPage() {
  const params = useParams<{ id: string }>()
  return <CourseCheatersTabs courseId={params.id} status="Flagged" />
}

export default withErrorBoundary(withSignedIn(CheatersSuspectedPage))
