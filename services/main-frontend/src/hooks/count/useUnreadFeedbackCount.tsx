import { useQuery } from "@tanstack/react-query"

import { fetchFeedbackCount } from "../../services/backend/feedback"

const createUnreadFeedbackCountHook = (courseId: string) => {
  const useFeedbackUnreadCount = () => {
    const getFeedbackCount = useQuery(
      [`feedback-count-${courseId}`],
      () => fetchFeedbackCount(courseId),
      { select: (data) => data.unread },
    )
    return getFeedbackCount
  }
  return useFeedbackUnreadCount
}

export default createUnreadFeedbackCountHook
