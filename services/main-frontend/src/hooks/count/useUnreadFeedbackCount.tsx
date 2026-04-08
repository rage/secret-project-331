"use client"

import { useQuery } from "@tanstack/react-query"

import { getUnreadFeedbackCountOptions } from "@/services/backend/feedback"

const createUnreadFeedbackCountHook = (courseId: string) => {
  const useFeedbackUnreadCount = () => {
    return useQuery(getUnreadFeedbackCountOptions(courseId))
  }
  return useFeedbackUnreadCount
}

export default createUnreadFeedbackCountHook
