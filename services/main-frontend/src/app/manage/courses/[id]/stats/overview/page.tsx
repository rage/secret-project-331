"use client"

import { useParams } from "next/navigation"

import OverviewTab from "../tabs/OverviewTab"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function StatsOverviewPage() {
  const params = useParams<{ id: string }>()
  return <OverviewTab courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(StatsOverviewPage))
