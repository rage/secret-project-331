import { useQuery } from "@tanstack/react-query"

import { fetchEditProposalCount } from "../../services/backend/proposedEdits"

const createPendingChangeRequestCountHook = (courseId: string) => {
  const usePendingChangeRequestCount = () => {
    const getEditProposalCount = useQuery({
      queryKey: [`edit-proposal-count-${courseId}`],
      queryFn: () => fetchEditProposalCount(courseId),
      select: (data) => data.pending,
    })
    return getEditProposalCount
  }
  return usePendingChangeRequestCount
}

export default createPendingChangeRequestCountHook
