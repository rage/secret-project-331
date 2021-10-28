import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchEditProposals, processProposal } from "../services/backend/proposedEdits"
import { BlockProposalInfo } from "../shared-module/bindings"

import EditProposalView from "./EditProposalView"

interface Props {
  courseId: string
  page: number
  limit: number
  pending: boolean
  onChange: () => Promise<unknown>
}

const EditProposalPage: React.FC<Props> = ({ courseId, page, limit, pending, onChange }) => {
  const { t } = useTranslation()
  const { isLoading, error, data, refetch } = useQuery(
    `edit-proposal-list-${courseId}-${pending}-${page}-${limit}`,
    () => fetchEditProposals(courseId, pending, page, limit),
  )

  if (error) {
    return (
      <div>
        <h1>{t("error-title")}</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
  }

  const proposals = data.filter((p) => p.pending == pending)
  if (proposals.length == 0) {
    return <div>{t("nothing-here")}</div>
  }

  async function handleProposal(
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposalInfo[],
  ) {
    await processProposal(pageId, pageProposalId, blockProposals)
    await refetch()
    await onChange()
  }

  return (
    <ul>
      {proposals.map((p) => (
        <li key={p.id}>
          <EditProposalView proposal={p} handleProposal={handleProposal} />
        </li>
      ))}
    </ul>
  )
}

export default EditProposalPage
