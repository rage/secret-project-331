"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import CourseCheatersTabs from "../CourseCheatersTabs"

function CheatersConfirmedPage() {
  const params = useParams<{ id: string }>()
  return <CourseCheatersTabs courseId={params.id} status="ConfirmedCheating" />
}

export default withErrorBoundary(withSignedIn(CheatersConfirmedPage))
