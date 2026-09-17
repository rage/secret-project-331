"use client"

import { css } from "@emotion/css"
import { useToggleGroupState } from "@react-stately/toggle"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useId } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  getCourseFeedbackCategoriesOptions,
  getCourseFeedbackOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult, ToggleGroup } from "@/shared-module/components"

import FeedbackView from "./FeedbackView"

const listCss = css`
  list-style: none;
  padding: 0;
`

interface Props {
  courseId: string
  page: number
  paginationInfo: PaginationInfo
  read: boolean
  onChange: () => Promise<unknown>
}

const FeedbackPage: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  page,
  paginationInfo,
  read,
  onChange,
}) => {
  const { t } = useTranslation()
  let state = useToggleGroupState({
    // oxlint-disable-next-line i18next/no-literal-string
    selectionMode: "single",
    disallowEmptySelection: true,
    defaultSelectedKeys: new Set([t("all")]),
  })
  let labelId = useId()
  const limit = paginationInfo.limit
  const getFeedbackList = useQuery({
    ...getCourseFeedbackOptions({
      path: {
        course_id: courseId,
      },
      query: {
        read,
        page,
        limit,
      },
    }),
  })
  const getFeedbackCategories = useQuery({
    ...getCourseFeedbackCategoriesOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const AllButton = <ToggleGroup labels={[t("all")]} state={state} />

  return (
    <>
      <QueryResult query={getFeedbackCategories} emptyFallback={AllButton}>
        {(data) => {
          const categories = data.map((c) => c.name)
          return (
            <>
              <span id={labelId}>{t("feedback-categories")}</span>
              <ToggleGroup
                aria-labelledby={labelId}
                labels={[t("all")].concat(categories)}
                state={state}
              />
            </>
          )
        }}
      </QueryResult>
      <QueryResult query={getFeedbackList} emptyFallback={<ul className={listCss} />}>
        {(data) => (
          <ul className={listCss}>
            {data
              .filter((f) => {
                // oxlint-disable-next-line i18next/no-literal-string
                return state.selectedKeys.has(t("all"))
                  ? true
                  : state.selectedKeys.has(f.feedback_category_name ?? "") // todo nulls
              })
              .map((f) => (
                <li key={f.id}>
                  <FeedbackView
                    courseId={courseId}
                    feedback={f}
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
