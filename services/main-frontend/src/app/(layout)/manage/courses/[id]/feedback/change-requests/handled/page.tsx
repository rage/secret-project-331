"use client"

import { useParams } from "next/navigation"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import EditProposalList from "../EditProposalList"

function ChangeRequestsOldPage() {
  const params = useParams<{ id: string }>()
  return <EditProposalList courseId={params.id} pending={false} perPage={4} />
}

export default withErrorBoundary(withSignedIn(ChangeRequestsOldPage))
