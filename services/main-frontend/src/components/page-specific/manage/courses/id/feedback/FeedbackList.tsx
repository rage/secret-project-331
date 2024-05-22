import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { fetchFeedbackCount } from "../../../../../../services/backend/feedback"

import FeedbackPage from "./FeedbackPage"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"

interface Props {
  courseId: string
  read: boolean
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getFeedbackCount = useQuery({
    queryKey: [`feedback-count-${courseId}`],
    queryFn: () => fetchFeedbackCount(courseId),
  })

  if (getFeedbackCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getFeedbackCount.error} />
  }

  if (getFeedbackCount.isPending) {
    return <Spinner variant={"medium"} />
  }

  const items = read ? getFeedbackCount.data.read : getFeedbackCount.data.unread
  if (items <= 0) {
    return <div>{t("no-feedback")}</div>
  }
  const pageCount = Math.ceil(items / paginationInfo.limit)
  return (
    <div>
      <FeedbackPage
        courseId={courseId}
        page={paginationInfo.page}
        read={read}
        paginationInfo={paginationInfo}
        onChange={getFeedbackCount.refetch}
      />
      <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
    </div>
  )
}

export default FeedbackList
