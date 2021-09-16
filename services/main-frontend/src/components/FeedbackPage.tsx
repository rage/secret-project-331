import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchFeedback, markAsRead } from "../services/backend/feedback"
import { Feedback } from "../shared-module/bindings"

import FeedbackView from "./FeedbackView"

interface Props {
  courseId: string
  page: number
  limit: number
  read: boolean
  onChange: () => Promise<unknown>
}

const FeedbackPage: React.FC<Props> = ({ courseId, page, limit, read, onChange }) => {
  const t = useTranslation()
  const { isLoading, error, data, refetch } = useQuery(
    `feedback-list-${courseId}-${read}-${page}`,
    () => fetchFeedback(courseId, read, page, limit),
  )

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <Trans i18nKey="loading-feedback">Loading feedback...</Trans>
  }

  async function handleMarkAsRead(feedback: Feedback) {
    await markAsRead(feedback.id, !feedback.marked_as_read)
    await refetch()
    await onChange()
  }

  return (
    <ul>
      {data.map((f) => (
        <li key={f.id}>
          <FeedbackView
            feedback={f}
            setRead={() => {
              handleMarkAsRead(f)
            }}
          />
        </li>
      ))}
    </ul>
  )
}

export default FeedbackPage
