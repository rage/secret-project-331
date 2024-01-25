import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { fetchEditProposalCount } from "../../../../../../services/backend/proposedEdits"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import Pagination from "../../../../../../shared-module/common/components/Pagination"
import Spinner from "../../../../../../shared-module/common/components/Spinner"
import usePaginationInfo from "../../../../../../shared-module/common/hooks/usePaginationInfo"

import EditProposalPage from "./EditProposalPage"

interface Props {
  courseId: string
  pending: boolean
  perPage: number
}

const EditProposalList: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pending,
  perPage,
}) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getEditProposalCount = useQuery({
    queryKey: [`edit-proposal-count-${courseId}`],
    queryFn: () => fetchEditProposalCount(courseId),
  })

  if (getEditProposalCount.isError) {
    return <ErrorBanner error={getEditProposalCount.error} />
  }

  if (getEditProposalCount.isPending) {
    return <Spinner variant="medium" />
  }

  const items = pending ? getEditProposalCount.data.pending : getEditProposalCount.data.handled
  if (items <= 0) {
    return <div>{t("no-change-requests")}</div>
  }

  const pageCount = Math.ceil(items / perPage)

  return (
    <div>
      <EditProposalPage
        courseId={courseId}
        page={paginationInfo.page}
        pending={pending}
        limit={perPage}
        onChange={getEditProposalCount.refetch}
      />
      <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
    </div>
  )
}

export default EditProposalList
