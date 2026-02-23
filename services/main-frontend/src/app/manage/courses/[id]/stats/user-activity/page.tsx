"use client"

import { useParams } from "next/navigation"

import UserActivityTab from "../tabs/UserActivityTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function StatsUserActivityPage() {
  const params = useParams<{ id: string }>()
  return <UserActivityTab courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(StatsUserActivityPage))
