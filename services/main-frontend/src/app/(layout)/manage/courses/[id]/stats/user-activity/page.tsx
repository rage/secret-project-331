"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import UserActivityTab from "../tabs/UserActivityTab"

function StatsUserActivityPage() {
  const params = useParams<{ id: string }>()
  return <UserActivityTab courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(StatsUserActivityPage))
