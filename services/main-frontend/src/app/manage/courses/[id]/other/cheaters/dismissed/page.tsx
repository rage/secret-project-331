"use client"

import { useParams } from "next/navigation"

import CourseCheatersTabs from "../CourseCheatersTabs"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CheatersDismissedPage() {
  const params = useParams<{ id: string }>()
  return <CourseCheatersTabs courseId={params.id} status="Dismissed" perPage={4} />
}

export default withErrorBoundary(withSignedIn(CheatersDismissedPage))
