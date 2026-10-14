"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import {
  getCourseFeedbackCategoriesOptions,
  getCourseFeedbackCountOptions,
  getCourseFeedbackOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CategoryFeedbackCount,
  FeedbackEditProposalCounts,
} from "@/generated/api/types.generated"
import useFeedbackCategoryToggleInfo from "@/hooks/useFeedbackCategoryToggleInfo"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { QueryResult, ToggleGroup, type ToggleInfo } from "@/shared-module/components"

import FeedbackView from "./FeedbackView"

const listCss = css`
  list-style: none;
  padding: 0;
`
interface Props {
  courseId: string
  read: boolean
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const { allFeedbackId, selectedCategory, toggleState } =
    useFeedbackCategoryToggleInfo(paginationInfo)

  const getFeedbackCount = useQuery({
    ...getCourseFeedbackCountOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const getFeedbackList = useQuery({
    ...getCourseFeedbackOptions({
      path: {
        course_id: courseId,
      },
      query: omitUndefined({
        read,
        page: paginationInfo.page,
        limit: paginationInfo.limit,
        category_filter:
          selectedCategory.current !== allFeedbackId ? selectedCategory.current : undefined,
      }),
    }),
  })
  const getFeedbackCategories = useQuery({
    ...getCourseFeedbackCategoriesOptions({
      path: {
        course_id: courseId,
      },
      query: { read },
    }),
  })

  const AllButton = (
    <ToggleGroup
      groupLabel={t("feedback-categories")}
      toggles={[{ id: allFeedbackId, name: t("all") }]}
      state={toggleState}
    />
  )

  return (
    <QueryResult query={getFeedbackCount}>
      {(countData) => {
        // use the query result data, unless a category is selected, then find
        // the correct category and use its read/unread counts
        let feedbackData: FeedbackEditProposalCounts | CategoryFeedbackCount = countData
        if (selectedCategory.current !== allFeedbackId) {
          feedbackData =
            countData.feedback_categories_counts.find(
              (x) => x.category_id === selectedCategory.current,
              // fall back to query result if not found
            ) ?? countData
        }

        const items = read ? feedbackData.read_feedback : feedbackData.unread_feedback
        if (items <= 0) {
          return <div>{t("no-feedback")}</div>
        }
        const pageCount = Math.ceil(items / paginationInfo.limit)
        return (
          <div>
            <QueryResult query={getFeedbackCategories} emptyFallback={AllButton}>
              {(data) => {
                const categories: ToggleInfo[] = data.map((c) => {
                  return { id: c.id, name: c.name }
                })
                return (
                  <ToggleGroup
                    groupLabel={t("feedback-categories")}
                    toggles={[{ id: allFeedbackId, name: t("all") }].concat(categories)}
                    state={toggleState}
                  />
                )
              }}
            </QueryResult>
            <QueryResult query={getFeedbackList} emptyFallback={<ul className={listCss} />}>
              {(data) => (
                <ul className={listCss}>
                  {data.map((f) => (
                    <li key={f.id}>
                      <FeedbackView
                        courseId={courseId}
                        feedback={f}
                        read={read}
                        setRead={async () => {
                          await getFeedbackList.refetch()
                          await getFeedbackCount.refetch()
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </QueryResult>
            <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default FeedbackList
