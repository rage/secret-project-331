"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { FieldSet } from "@/app/(layout)/manage/course-auditing/page"
import {
  getCourseFeedbackCategoriesOptions,
  getCourseFeedbackOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import type { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

import FeedbackView from "./FeedbackView"

const listClassName = css`
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
  // oxlint-disable-next-line i18next/no-literal-string
  const [categoryFilter, setCategoryFilter] = useState("all")
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

  const AllButton = (
    <RadioButton
      key={0}
      label={t("all")}
      name={t("all")}
      checked={"all" === categoryFilter}
      // oxlint-disable-next-line i18next/no-literal-string
      onClick={() => setCategoryFilter("all")}
    />
  )

  return (
    <>
      <QueryResult query={getFeedbackCategories} emptyFallback={AllButton}>
        {(data) => (
          <FieldSet>
            {AllButton}
            {data.map((c) => (
              <RadioButton
                key={c.id}
                label={c.name} //option label accessible
                name={c.name}
                checked={c.name === categoryFilter}
                onClick={() => setCategoryFilter(c.name)}
              />
            ))}
          </FieldSet>
        )}
      </QueryResult>
      <QueryResult query={getFeedbackList} emptyFallback={<ul className={listClassName} />}>
        {(data) => (
          <ul className={listClassName}>
            {data
              .filter((f) => {
                return categoryFilter === "all" ? true : f.feedback_category_name === categoryFilter
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
