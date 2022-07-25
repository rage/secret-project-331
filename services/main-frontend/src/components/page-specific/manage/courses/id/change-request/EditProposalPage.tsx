import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

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
    [`edit-proposal-list-${courseId}-${pending}-${page}-${limit}`],
    () => fetchEditProposals(courseId, pending, page, limit),
    { select: (data) => data.filter((p) => p.pending === pending) }
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

  if (getEditProposalList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getEditProposalList.error} />
  }

  if (getEditProposalList.isLoading || getEditProposalList.isIdle) {
    return <Spinner variant={"medium"} />
  }

  if (getEditProposalList.data.length === 0) {
    return <div>{t("nothing-here")}</div>
  }

  return (
    <ul
      className={css`
        list-style: none;
        padding: 0;
      `}
    >
      {getEditProposalList.data.map((p) => (
        <li key={p.id}>
          <EditProposalView proposal={p} handleProposal={handleProposal} />
        </li>
      ))}
    </ul>
  )
}

export default EditProposalPage
