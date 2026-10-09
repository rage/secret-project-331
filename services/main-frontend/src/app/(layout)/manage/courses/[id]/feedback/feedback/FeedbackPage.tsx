"use client"

import { css } from "@emotion/css"
import type { ToggleGroupState } from "@react-stately/toggle"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseFeedbackCategoriesOptions,
  getCourseFeedbackOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { QueryResult, ToggleGroup } from "@/shared-module/components"
import type { ToggleInfo } from "@/shared-module/components"

import FeedbackView from "./FeedbackView"

const listCss = css`
  list-style: none;
  padding: 0;
`

interface Props {
  courseId: string
  allButtonId: string
  page: number
  paginationInfo: PaginationInfo
  read: boolean
  onChange: () => Promise<unknown>
  state: ToggleGroupState
}

const FeedbackPage: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  allButtonId,
  page,
  paginationInfo,
  read,
  onChange,
  state,
}) => {
  const { t } = useTranslation()
  const allToggleInfo = { id: allButtonId, name: t("all") }
  const limit = paginationInfo.limit

  let selectedCategory = state.selectedKeys.keys().next().value?.toString()
  let category_filter = selectedCategory === allButtonId ? undefined : selectedCategory

  const getFeedbackList = useQuery({
    ...getCourseFeedbackOptions({
      path: {
        course_id: courseId,
      },
      query: omitUndefined({
        read,
        page,
        limit,
        category_filter,
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
    <ToggleGroup groupLabel={t("feedback-categories")} toggles={[allToggleInfo]} state={state} />
  )

  return (
    <>
      <QueryResult query={getFeedbackCategories} emptyFallback={AllButton}>
        {(data) => {
          const categories: ToggleInfo[] = data.map((c) => {
            return { id: c.id, name: c.name }
          })
          return (
            <ToggleGroup
              groupLabel={t("feedback-categories")}
              toggles={[allToggleInfo].concat(categories)}
              state={state}
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
                    await onChange()
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryResult>
    </>
  )
}

export default FeedbackPage
