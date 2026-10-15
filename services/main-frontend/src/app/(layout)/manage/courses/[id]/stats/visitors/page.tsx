"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import VisitorsTab from "../tabs/VisitorsTab"

function StatsVisitorsPage() {
  const params = useParams<{ id: string }>()
  return <VisitorsTab courseId={params.id} />
}

export default withErrorBoundary(withSignedIn(StatsVisitorsPage))
