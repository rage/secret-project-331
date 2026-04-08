"use client"

import { useQuery } from "@tanstack/react-query"

import { getEditProposalCountOptions } from "@/services/backend/proposedEdits"

const createPendingChangeRequestCountHook = (courseId: string) => {
  const usePendingChangeRequestCount = () => {
    const getEditProposalCount = useQuery({
      ...getEditProposalCountOptions(courseId),
      select: (data) => data.pending,
    })
    return getEditProposalCount
  }
  return usePendingChangeRequestCount
}

export default createPendingChangeRequestCountHook
