"use client"

import { useQuery } from "@tanstack/react-query"

import { getEditProposalCountOptions } from "@/generated/api/@tanstack/react-query.generated"

const createPendingChangeRequestCountHook = (courseId: string) => {
  const usePendingChangeRequestCount = () => {
    const getEditProposalCount = useQuery({
      ...getEditProposalCountOptions({
        path: {
          course_id: courseId,
        },
      }),
      select: (data) => data.pending,
    })
    return getEditProposalCount
  }
  return usePendingChangeRequestCount
}

export default createPendingChangeRequestCountHook
