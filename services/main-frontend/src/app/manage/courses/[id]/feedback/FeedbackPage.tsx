"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import FeedbackView from "./FeedbackView"

import { getCourseFeedbackOptions } from "@/generated/api/@tanstack/react-query.generated"
import { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

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

  const listClassName = css`
    list-style: none;
    padding: 0;
  `

  return (
    <QueryResult query={getFeedbackList} emptyFallback={<ul className={listClassName} />}>
      {(data) => (
        <ul className={listClassName}>
          {data.map((f) => (
            <li key={f.id}>
              <FeedbackView
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
  )
}

export default FeedbackPage
