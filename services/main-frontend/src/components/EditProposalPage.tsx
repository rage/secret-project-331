import { useQuery } from "react-query"

import {
  acceptEditProposalBlocks,
  fetchEditProposals,
  rejectEditProposalBlocks,
} from "../services/backend/proposedEdits"
import { BlockProposal } from "../shared-module/bindings"

import EditProposalView from "./EditProposalView"

interface Props {
  courseId: string
  page: number
  limit: number
  pending: boolean
  onChange: () => Promise<unknown>
}

const EditProposalPage: React.FC<Props> = ({ courseId, page, limit, pending, onChange }) => {
  const { isLoading, error, data, refetch } = useQuery(
    `edit-proposal-list-${courseId}-${pending}-${page}-${limit}`,
    () => fetchEditProposals(courseId, pending, page, limit),
  )

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading feedback...</div>
  }

  const proposals = data.filter((p) => p.pending == pending)
  if (proposals.length == 0) {
    return <div>Nothing here!</div>
  }

  async function handleAcceptBlocks(
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposal[],
  ) {
    await acceptEditProposalBlocks(
      pageId,
      pageProposalId,
      blockProposals.map((b) => b.id),
    )
    await refetch()
    await onChange()
  }

  async function handleRejectBlocks(
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposal[],
  ) {
    await rejectEditProposalBlocks(
      pageId,
      pageProposalId,
      blockProposals.map((b) => b.id),
    )
    await refetch()
    await onChange()
  }

  return (
    <ul>
      {proposals.map((p) => (
        <li key={p.id}>
          <EditProposalView
            proposal={p}
            handleAcceptBlocks={handleAcceptBlocks}
            handleRejectBlocks={handleRejectBlocks}
          />
        </li>
      ))}
    </ul>
  )
}

export default EditProposalPage
