"use client"

import { useParams } from "next/navigation"

import CourseCheatersTabs from "../CourseCheatersTabs"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function CheatersConfirmedPage() {
  const params = useParams<{ id: string }>()
  return <CourseCheatersTabs courseId={params.id} status="ConfirmedCheating" perPage={4} />
}

export default withErrorBoundary(withSignedIn(CheatersConfirmedPage))
