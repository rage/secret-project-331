"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getCourseFeedbackCountOptions } from "@/generated/api/@tanstack/react-query.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

import FeedbackPage from "./FeedbackPage"

interface Props {
  courseId: string
  read: boolean
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getFeedbackCount = useQuery({
    ...getCourseFeedbackCountOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  return (
    <QueryResult query={getFeedbackCount}>
      {(data) => {
        const items = read ? data.read : data.unread
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
      }}
    </QueryResult>
  )
}

export default FeedbackList
