import React from "react"
import { useQuery } from "react-query"

import { fetchFeedback, markAsRead } from "../../../../../../services/backend/feedback"
import { Feedback } from "../../../../../../shared-module/bindings"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import FeedbackView from "../../../../../FeedbackView"

interface Props {
  courseId: string
  page: number
  limit: number
  read: boolean
  onChange: () => Promise<unknown>
}

const FeedbackPage: React.FC<Props> = ({ courseId, page, limit, read, onChange }) => {
  const getFeedbackList = useQuery(`feedback-list-${courseId}-${read}-${page}-${limit}`, () =>
    fetchFeedback(courseId, read, page, limit),
  )

  async function handleMarkAsRead(feedback: Feedback) {
    await markAsRead(feedback.id, !feedback.marked_as_read)
    await getFeedbackList.refetch()
    await onChange()
  }

  return (
    <>
      {getFeedbackList.isError && (
        <ErrorBanner variant={"readOnly"} error={getFeedbackList.error} />
      )}
      {getFeedbackList.isLoading && <Spinner variant={"medium"} />}
      {getFeedbackList.isSuccess && (
        <ul>
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
      )}
    </>
  )
}

export default FeedbackPage
