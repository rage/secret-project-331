"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseFeedbackCountOptions } from "@/generated/api/@tanstack/react-query.generated"

type WhichCount = "feedback" | "change_requests" | "both"

const createFeedbackEditProposalCountsHook = (courseId: string, count: WhichCount) => {
  const useCount = () => {
    return useQuery({
      ...getCourseFeedbackCountOptions({
        path: {
          course_id: courseId,
        },
      }),
      gcTime: 1000 * 60 * 5, // 5 minutes
      select: (data) => {
        switch (count) {
          case "both":
            return data.total_waiting
          case "feedback":
            return data.unread_feedback
          case "change_requests":
            return data.pending_edits
        }
      },
    })
  }
  return useCount
}

export default createFeedbackEditProposalCountsHook
