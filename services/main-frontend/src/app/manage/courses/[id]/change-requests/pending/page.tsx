"use client"

import { useParams } from "next/navigation"
import React from "react"

import EditProposalList from "../EditProposalList"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

function ChangeRequestsPendingPage() {
  const params = useParams<{ id: string }>()
  return <EditProposalList courseId={params.id} pending={true} perPage={4} />
}

export default withErrorBoundary(withSignedIn(ChangeRequestsPendingPage))
