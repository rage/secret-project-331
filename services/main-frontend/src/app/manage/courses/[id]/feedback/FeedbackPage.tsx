"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import FeedbackView from "./FeedbackView"

import { getFeedbackOptions } from "@/services/backend/feedback"
import { Feedback } from "@/shared-module/common/bindings"
import DataLoadError from "@/shared-module/common/components/DataLoadError"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { PaginationInfo } from "@/shared-module/common/hooks/usePaginationInfo"

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
  const getFeedbackList = useQuery(getFeedbackOptions(courseId, read, page, limit))

  if (getFeedbackList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getFeedbackList.error} />
  }

  if (getFeedbackList.isLoading) {
    return <Spinner variant={"medium"} />
  }

  if (!getFeedbackList.data) {
    return (
      <DataLoadError
        onRetry={() => {
          void getFeedbackList.refetch()
        }}
      />
    )
  }

  return (
    <ul
      className={css`
        list-style: none;
        padding: 0;
      `}
    >
      {getFeedbackList.data.map((f) => (
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
  )
}

export default FeedbackPage
