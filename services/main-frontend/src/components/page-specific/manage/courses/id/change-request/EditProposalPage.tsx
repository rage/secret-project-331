import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import {
  fetchEditProposals,
  processProposal,
} from "../../../../../../services/backend/proposedEdits"
import { BlockProposalInfo } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

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
  const getEditProposalList = useQuery(
    `edit-proposal-list-${courseId}-${pending}-${page}-${limit}`,
    () => fetchEditProposals(courseId, pending, page, limit),
    { select: (data) => data.filter((p) => p.pending === pending) },
  )

  async function handleProposal(
    pageId: string,
    pageProposalId: string,
    blockProposals: BlockProposalInfo[],
  ) {
    await processProposal(pageId, pageProposalId, blockProposals)
    await getEditProposalList.refetch()
    await onChange()
  }

  return (
    <>
      {getEditProposalList.isError && (
        <ErrorBanner variant={"readOnly"} error={getEditProposalList.error} />
      )}
      {getEditProposalList.isLoading && <Spinner variant={"medium"} />}
      {getEditProposalList.isSuccess && getEditProposalList.data.length !== 0 ? (
        <ul>
          {getEditProposalList.data.map((p) => (
            <li key={p.id}>
              <EditProposalView proposal={p} handleProposal={handleProposal} />
            </li>
          ))}
        </ul>
      ) : (
        <div>{t("nothing-here")}</div>
      )}
    </>
  )
}

export default EditProposalPage
