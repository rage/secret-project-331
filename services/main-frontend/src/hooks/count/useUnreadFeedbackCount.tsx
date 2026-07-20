"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseFeedbackCountOptions } from "@/generated/api/@tanstack/react-query.generated"

const createUnreadFeedbackCountHook = (courseId: string) => {
  const useFeedbackUnreadCount = () => {
    return useQuery({
      ...getCourseFeedbackCountOptions({
        path: {
          course_id: courseId,
        },
      }),
      select: (data) => data.unread,
    })
  }
  return useFeedbackUnreadCount
}

export default createUnreadFeedbackCountHook
