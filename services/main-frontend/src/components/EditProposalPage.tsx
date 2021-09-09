import { useQuery } from "react-query"

import { fetchEditProposals } from "../services/backend/proposedEdits"
import { Feedback } from "../shared-module/bindings"

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
    `edit-proposal-list-${courseId}-${page}`,
    () => fetchEditProposals(courseId, page, limit),
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

  return (
    <ul>
      {proposals.map((p) => (
        <li key={p.id}>
          <EditProposalView proposal={p} />
        </li>
      ))}
    </ul>
  )
}

export default EditProposalPage
