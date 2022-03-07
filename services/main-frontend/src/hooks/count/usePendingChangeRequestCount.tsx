import { useQuery } from "react-query"

import { fetchEditProposalCount } from "../../services/backend/proposedEdits"

const createPendingChangeRequestCountHook = (courseId: string) => {
  const usePendingChangeRequestCount = () => {
    const getEditProposalCount = useQuery(
      `edit-proposal-count-${courseId}`,
      () => fetchEditProposalCount(courseId),
      { select: (data) => data.pending },
    )
    return getEditProposalCount
  }
  return usePendingChangeRequestCount
}

export default createPendingChangeRequestCountHook
