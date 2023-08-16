import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { fetchFeedbackCount } from "../../../../../../services/backend/feedback"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../../../shared-module/components/Pagination"
import Spinner from "../../../../../../shared-module/components/Spinner"
import usePaginationInfo from "../../../../../../shared-module/hooks/usePaginationInfo"

import FeedbackPage from "./FeedbackPage"

interface Props {
  courseId: string
  read: boolean
  perPage: number
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read, perPage }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getFeedbackCount = useQuery({
    queryKey: [`feedback-count-${courseId}`],
    queryFn: () => fetchFeedbackCount(courseId),
  })

  if (getFeedbackCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getFeedbackCount.error} />
  }

  if (getFeedbackCount.isLoading) {
    return <Spinner variant={"medium"} />
  }

  const items = read ? getFeedbackCount.data.read : getFeedbackCount.data.unread
  if (items <= 0) {
    return <div>{t("no-feedback")}</div>
  }
  const pageCount = Math.ceil(items / perPage)
  return (
    <div>
      <FeedbackPage
        courseId={courseId}
        page={paginationInfo.page}
        read={read}
        limit={perPage}
        onChange={getFeedbackCount.refetch}
      />
      <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
    </div>
  )
}

export default FeedbackList
