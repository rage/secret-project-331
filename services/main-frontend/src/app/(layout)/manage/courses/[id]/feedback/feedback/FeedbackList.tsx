"use client"

import { useToggleGroupState } from "@react-stately/toggle"
import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseFeedbackCountOptions } from "@/generated/api/@tanstack/react-query.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

import FeedbackPage from "../feedback/FeedbackPage"

interface Props {
  courseId: string
  read: boolean
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const allButtonId = useId()
  const [categoryFilter, setCategoryFilter] = useState<string>(allButtonId)
  let toggleState = useToggleGroupState({
    // oxlint-disable-next-line i18next/no-literal-string
    selectionMode: "single",
    disallowEmptySelection: true,
    defaultSelectedKeys: new Set([allButtonId]),
  })
  let selectedCategory = toggleState.selectedKeys.keys().next().value?.toString()
  if (selectedCategory && selectedCategory !== categoryFilter) {
    paginationInfo.setPage(1)
    setCategoryFilter(selectedCategory)
  }

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
        let y =
          categoryFilter !== allButtonId
            ? (data.feedback_categories_counts.find((x) => x.category_id === categoryFilter) ??
              data)
            : data
        const items = read ? y.read_feedback : y.unread_feedback
        if (items <= 0) {
          return <div>{t("no-feedback")}</div>
        }
        const pageCount = Math.ceil(items / paginationInfo.limit)
        return (
          <div>
            <FeedbackPage
              courseId={courseId}
              allButtonId={allButtonId}
              page={paginationInfo.page}
              read={read}
              paginationInfo={paginationInfo}
              onChange={getFeedbackCount.refetch}
              state={toggleState}
            />
            <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default FeedbackList
