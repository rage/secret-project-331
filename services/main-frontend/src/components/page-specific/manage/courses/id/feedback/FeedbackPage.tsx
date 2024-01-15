import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import { fetchFeedback, markAsRead } from "../../../../../../services/backend/feedback"
import { Feedback } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

import FeedbackView from "./FeedbackView"

interface Props {
  courseId: string
  page: number
  limit: number
  read: boolean
  onChange: () => Promise<unknown>
}

const FeedbackPage: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  page,
  limit,
  read,
  onChange,
}) => {
  const getFeedbackList = useQuery({
    queryKey: [`feedback-list-${courseId}-${read}-${page}-${limit}`],
    queryFn: () => fetchFeedback(courseId, read, page, limit),
  })

  async function handleMarkAsRead(feedback: Feedback) {
    await markAsRead(feedback.id, !feedback.marked_as_read)
    await getFeedbackList.refetch()
    await onChange()
  }

  if (getFeedbackList.isError) {
    return <ErrorBanner variant={"readOnly"} error={getFeedbackList.error} />
  }

  if (getFeedbackList.isPending) {
    return <Spinner variant={"medium"} />
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
